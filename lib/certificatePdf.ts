// One A4 page. JPEG pixels are embedded directly; the preview is the single layout source.
export function certificatePdf(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  const encode = (s: string) => new TextEncoder().encode(s);
  const chunks: Uint8Array[] = [], offsets = [0]; let size = 0;
  const put = (v: Uint8Array | string) => { const b = typeof v === 'string' ? encode(v) : v; chunks.push(b); size += b.length; };
  const obj = (n: number, content: string) => { offsets[n] = size; put(`${n} 0 obj\n${content}\nendobj\n`); };
  put('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4] = size; put(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); put(jpeg); put('\nendstream\nendobj\n');
  const commands = 'q\n595.276 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
  obj(5, `<< /Length ${encode(commands).length} >>\nstream\n${commands}endstream`);
  const xref = size; put('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) put(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const result = new Uint8Array(size); let at = 0; for (const chunk of chunks) { result.set(chunk, at); at += chunk.length; }
  return result;
}
