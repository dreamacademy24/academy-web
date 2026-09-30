/* Plain-text URLs across staff comments and chat; no HTML from message text is trusted. */
(function(){
  'use strict';
  var blocked='a,button,script,style,textarea,input,select,option,code,pre,[contenteditable]:not([contenteditable="false"])';
  function convert(node){
    if(!node.parentElement||node.parentElement.closest(blocked))return;
    var text=node.nodeValue;if(!/https?:\/\//i.test(text))return;
    var re=/https?:\/\/[^\s<>"']+/gi,match,last=0,fragment=document.createDocumentFragment();
    while((match=re.exec(text))){
      var url=match[0].replace(/[.,!?;:]+$/g,'');
      while(/[)\]}]$/.test(url)){var close=url.slice(-1),open={')':'(',']':'[','}':'{'}[close];if(url.split(close).length<=url.split(open).length)break;url=url.slice(0,-1);}
      fragment.appendChild(document.createTextNode(text.slice(last,match.index)));
      var link=document.createElement('a');link.href=url;link.textContent=url;link.target='_blank';link.rel='noopener noreferrer';link.className='staff-message-link';
      fragment.appendChild(link);fragment.appendChild(document.createTextNode(match[0].slice(url.length)));last=re.lastIndex;
    }
    if(last){fragment.appendChild(document.createTextNode(text.slice(last)));node.replaceWith(fragment);}
  }
  function scan(root){
    if(root.nodeType===3){convert(root);return;}if(root.nodeType!==1||root.closest(blocked))return;
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[],node;while((node=walker.nextNode()))nodes.push(node);nodes.forEach(convert);
  }
  function start(){
    var style=document.createElement('style');style.textContent='a.staff-message-link{color:#245ac5!important;text-decoration:underline!important;text-underline-offset:3px;overflow-wrap:anywhere;word-break:break-word}a.staff-message-link:hover{color:#163d8a!important}a.staff-message-link:focus-visible{outline:3px solid #946fd7;outline-offset:3px}';document.head.appendChild(style);
    scan(document.body);
    var observer=new MutationObserver(function(records){observer.disconnect();records.forEach(function(record){if(record.type==='characterData')scan(record.target);else record.addedNodes.forEach(scan);});watch();});
    function watch(){observer.observe(document.body,{subtree:true,childList:true,characterData:true});}watch();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();