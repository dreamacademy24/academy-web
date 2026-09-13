param([switch]$ListVoices, [switch]$OnlyGreeting, [switch]$PitchProbe)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
public static class DreamyPcm {
  public static byte[] Trim(byte[] pcm, int rate) {
    int count = pcm.Length / 2, first = 0, last = count - 1;
    while (first < count && Math.Abs((int)BitConverter.ToInt16(pcm, first * 2)) < 80) first++;
    while (last >= first && Math.Abs((int)BitConverter.ToInt16(pcm, last * 2)) < 80) last--;
    if (first >= count) throw new InvalidOperationException("The generated voice contains only silence.");
    first = Math.Max(0, first - (int)(rate * .012));
    last = Math.Min(count - 1, last + (int)(rate * .04));
    byte[] result = new byte[(last - first + 1) * 2];
    Buffer.BlockCopy(pcm, first * 2, result, 0, result.Length);
    return result;
  }
  public static double LeadingSilence(byte[] pcm, int rate) {
    int i = 0;
    while (i < pcm.Length / 2 && Math.Abs((int)BitConverter.ToInt16(pcm, i * 2)) < 80) i++;
    return (double)i / rate;
  }
  public static double Pitch(byte[] pcm, int rate) {
    int count = pcm.Length / 2, width = 1024, maxLag = rate / 75;
    double[] samples = new double[count];
    for (int i = 0; i < count; i++) samples[i] = BitConverter.ToInt16(pcm, i * 2);
    var pitches = new List<double>();
    for (int start = 0; start + width + maxLag < count; start += rate / 50) {
      double power = 0;
      for (int i = 0; i < width; i++) power += samples[start+i] * samples[start+i];
      if (power / width < 40000) continue;
      double cumulative = 0;
      double[] normalized = new double[maxLag + 1];
      for (int lag = 1; lag <= maxLag; lag++) {
        double difference = 0;
        for (int i = 0; i < width; i++) {
          double d = samples[start+i] - samples[start+i+lag];
          difference += d*d;
        }
        cumulative += difference;
        normalized[lag] = cumulative == 0 ? 1 : difference * lag / cumulative;
      }
      for (int lag = rate / 650; lag < maxLag; lag++) {
        if (normalized[lag] >= .18) continue;
        while (lag + 1 <= maxLag && normalized[lag+1] < normalized[lag]) lag++;
        pitches.Add((double)rate / lag);
        break;
      }
    }
    if (pitches.Count == 0) return 0;
    pitches.Sort();
    return pitches[pitches.Count / 2];
  }
}
'@
$synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer

try {
  $installedVoices = @($synthesizer.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { $_.VoiceInfo.Name })
  if ($ListVoices) {
    $synthesizer.GetInstalledVoices() | ForEach-Object {
      [pscustomobject]@{ Name = $_.VoiceInfo.Name; Culture = $_.VoiceInfo.Culture.Name; Enabled = $_.Enabled }
    } | Format-Table -AutoSize
    return
  }

  $projectDirectory = Split-Path -Parent $PSScriptRoot
  $timelinePath = Join-Path $PSScriptRoot 'dreamy-intro-timeline.json'
  $timeline = Get-Content -LiteralPath $timelinePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $outputDirectory = Join-Path $projectDirectory 'public/learning/tree-house'
  $workDirectory = Join-Path $projectDirectory 'artifacts/dreamy-narration'
  [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
  [System.IO.Directory]::CreateDirectory($workDirectory) | Out-Null
  $sampleRate = [int]$timeline.sampleRate
  $bytesPerSample = 2
  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo($sampleRate, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

  foreach ($language in @('ko', 'en')) {
    $voiceName = $timeline.voices.$language.name
    if ($installedVoices -notcontains $voiceName) { throw "Required local voice is not installed: $voiceName" }
  }

  function Read-PcmData([string]$Path) {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ([System.Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'RIFF' -or [System.Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne 'WAVE') { throw "Invalid WAV: $Path" }
    $offset = 12
    $formatValid = $false
    while ($offset + 8 -le $bytes.Length) {
      $chunk = [System.Text.Encoding]::ASCII.GetString($bytes, $offset, 4)
      $size = [BitConverter]::ToUInt32($bytes, $offset + 4)
      if ($offset + 8 + $size -gt $bytes.Length) { throw "Truncated WAV: $Path" }
      if ($chunk -eq 'fmt ') {
        $formatValid = [BitConverter]::ToUInt16($bytes, $offset + 8) -eq 1 -and [BitConverter]::ToUInt16($bytes, $offset + 10) -eq 1 -and [BitConverter]::ToUInt32($bytes, $offset + 12) -eq $sampleRate -and [BitConverter]::ToUInt16($bytes, $offset + 22) -eq 16
      }
      if ($chunk -eq 'data') {
        if (-not $formatValid) { throw "Expected mono PCM16 $sampleRate Hz: $Path" }
        $pcm = New-Object byte[] $size
        [Array]::Copy($bytes, $offset + 8, $pcm, 0, $size)
        return @{ Bytes = $pcm }
      }
      $offset += 8 + $size + ($size % 2)
    }
    throw "Missing WAV data: $Path"
  }

  function Write-PcmWave([string]$Path, [byte[]]$Pcm) {
    $stream = [System.IO.File]::Create($Path)
    $writer = New-Object System.IO.BinaryWriter($stream)
    try {
      $writer.Write([System.Text.Encoding]::ASCII.GetBytes('RIFF'))
      $writer.Write([uint32](36 + $Pcm.Length))
      $writer.Write([System.Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
      $writer.Write([uint32]16)
      $writer.Write([uint16]1)
      $writer.Write([uint16]1)
      $writer.Write([uint32]$sampleRate)
      $writer.Write([uint32]($sampleRate * $bytesPerSample))
      $writer.Write([uint16]$bytesPerSample)
      $writer.Write([uint16]16)
      $writer.Write([System.Text.Encoding]::ASCII.GetBytes('data'))
      $writer.Write([uint32]$Pcm.Length)
      $writer.Write($Pcm)
    } finally {
      $writer.Dispose()
      $stream.Dispose()
    }
  }

  function Format-VttTime([double]$Seconds) {
    $time = [TimeSpan]::FromMilliseconds([math]::Round($Seconds * 1000))
    return ('{0:00}:{1:00}:{2:00}.{3:000}' -f [int]$time.TotalHours, $time.Minutes, $time.Seconds, $time.Milliseconds)
  }

  function Speak-Segment([string]$Text, [string]$Language, [string]$Path, [string]$Pitch) {
    $voice = $timeline.voices.$Language
    $synthesizer.SelectVoice($voice.name)
    $synthesizer.Rate = 0
    $synthesizer.Volume = 100
    $culture = if ($Language -eq 'ko') { 'ko-KR' } else { 'en-US' }
    $escaped = [System.Security.SecurityElement]::Escape($Text)
    $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + $culture + '"><prosody pitch="' + $Pitch + '">' + $escaped + '</prosody></speak>'
    $synthesizer.SetOutputToWaveFile($Path, $format)
    $synthesizer.SpeakSsml($ssml)
    $synthesizer.SetOutputToNull()
  }

  if ($PitchProbe) {
    $probeText = [string]$timeline.cues[0].speech[0].text
    $neutralPath = Join-Path $workDirectory 'pitch-neutral.wav'
    $brightPath = Join-Path $workDirectory 'pitch-bright.wav'
    Speak-Segment $probeText 'ko' $neutralPath '+0%'
    Speak-Segment $probeText 'ko' $brightPath '+30%'
    $neutral = Read-PcmData $neutralPath
    $bright = Read-PcmData $brightPath
    $neutralPitch = [DreamyPcm]::Pitch($neutral.Bytes, $sampleRate)
    $brightPitch = [DreamyPcm]::Pitch($bright.Bytes, $sampleRate)
    [pscustomobject]@{ NeutralHz = [math]::Round($neutralPitch, 1); BrightHz = [math]::Round($brightPitch, 1); Ratio = [math]::Round($brightPitch / $neutralPitch, 3); EqualHash = ((Get-FileHash -LiteralPath $neutralPath).Hash -eq (Get-FileHash -LiteralPath $brightPath).Hash) } | Format-List
    return
  }

  $vtt = New-Object System.Text.StringBuilder
  [void]$vtt.AppendLine('WEBVTT')
  [void]$vtt.AppendLine()
  $summaries = @()
  $nextStart = 0.0
  $cueCount = if ($OnlyGreeting) { 1 } else { $timeline.cues.Count }

  for ($cueIndex = 0; $cueIndex -lt $cueCount; $cueIndex++) {
    $cue = $timeline.cues[$cueIndex]
    $combined = New-Object System.IO.MemoryStream
    try {
      for ($index = 0; $index -lt $cue.speech.Count; $index++) {
        $segment = $cue.speech[$index]
        $segmentPath = Join-Path $workDirectory ($cue.id + '-' + $index + '.wav')
        Speak-Segment ([string]$segment.text) ([string]$segment.lang) $segmentPath '+30%'
        $part = Read-PcmData $segmentPath
        $trimmed = [DreamyPcm]::Trim($part.Bytes, $sampleRate)
        $combined.Write($trimmed, 0, $trimmed.Length)
        if ($index -lt $cue.speech.Count - 1) {
          $silence = New-Object byte[] ([int]($sampleRate * $bytesPerSample * 0.12))
          $combined.Write($silence, 0, $silence.Length)
        }
      }
      $pcm = $combined.ToArray()
      $duration = [math]::Round($pcm.Length / ($sampleRate * $bytesPerSample), 4)
      $cue.start = $nextStart
      $audioStart = [double]$cue.start + 0.04
      $audioEnd = [math]::Round($audioStart + $duration, 4)
      $tail = if ($cueIndex -eq $timeline.cues.Count - 1) { 0.65 } else { 0.30 }
      $cue.end = [math]::Ceiling(($audioEnd + $tail) * 10) / 10
      $nextStart = $cue.end
      $fileName = [System.IO.Path]::GetFileName([string]$cue.audioSrc)
      Write-PcmWave (Join-Path $outputDirectory $fileName) $pcm
      $cue | Add-Member -NotePropertyName audioStart -NotePropertyValue $audioStart -Force
      $cue | Add-Member -NotePropertyName audioDuration -NotePropertyValue $duration -Force
      $cue | Add-Member -NotePropertyName audioEnd -NotePropertyValue $audioEnd -Force
      $cue | Add-Member -NotePropertyName leadingSilence -NotePropertyValue ([math]::Round([DreamyPcm]::LeadingSilence($pcm, $sampleRate), 4)) -Force
      [void]$vtt.AppendLine([string]$cue.id)
      [void]$vtt.AppendLine((Format-VttTime $audioStart) + ' --> ' + (Format-VttTime ([math]::Min([double]$cue.end - 0.1, $audioEnd + 0.4))))
      [void]$vtt.AppendLine([string]$cue.text)
      [void]$vtt.AppendLine()
      $summaries += [pscustomobject]@{ Cue = $cue.id; File = $fileName; Start = $audioStart; Duration = $duration; End = $audioEnd; SceneEnd = $cue.end; LeadingSilence = $cue.leadingSilence }
    } finally {
      $combined.Dispose()
    }
  }

  if ($OnlyGreeting) { $summaries | Format-Table -AutoSize; return }
  $timeline.durationSeconds = $nextStart

  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($timelinePath, ($timeline | ConvertTo-Json -Depth 8) + [Environment]::NewLine, $utf8)
  [System.IO.File]::WriteAllText((Join-Path $outputDirectory 'dreamy-intro.ko.vtt'), $vtt.ToString(), $utf8)
  $summaries | Format-Table -AutoSize
  Write-Output 'Local narration complete. No external speech service was used.'
} finally {
  $synthesizer.Dispose()
}
