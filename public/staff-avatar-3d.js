import * as T from './vendor/three/three.module.min.js';
const palettes={skin:{porcelain:'#ffe5cf',peach:'#f5c3a0',warm:'#dba77d',tan:'#b47a53',deep:'#754c39'},hairColor:{brown:'#53372b',black:'#24232f',gold:'#d5a54d',pink:'#d779ac',silver:'#bac4da',purple:'#8357b5',copper:'#a65732',blue:'#4e77ae'},outfitColor:{purple:'#8961ca',mint:'#50ae96',blue:'#568bd0',orange:'#e68c3b',pink:'#da86b1',cream:'#e9daba',black:'#333344',red:'#bf4e62'},background:{lavender:'#eee5ff',mint:'#def5eb',sky:'#d7eafa',peach:'#fbe4dc',night:'#29233e',forest:'#c7d9cb',sunset:'#f5c9ac',snow:'#edf2f9'}};
export function mount(host,config,options={}){
 const scene=new T.Scene();scene.background=new T.Color(palettes.background[config.background]||'#eee5ff');
 if(options.transparent)scene.background=null;
 const camera=new T.OrthographicCamera(-2.25,2.25,2.65,-2.65,.1,50);camera.position.set(0,2.8,8);camera.lookAt(0,1.8,0);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:!!options.transparent,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(320,380);renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.domElement.style.cssText='width:100%;height:auto;display:block;touch-action:pan-y;border-radius:20px';renderer.domElement.setAttribute('aria-label','3D 아바타. 좌우로 드래그하면 회전합니다.');host.append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xffffff,0xb3a6c2,2.8));const sun=new T.DirectionalLight(0xfff5eb,2.4);sun.position.set(-3,6,5);sun.castShadow=true;sun.shadow.mapSize.set(512,512);scene.add(sun);const rim=new T.DirectionalLight(0xd8dfff,1.4);rim.position.set(3,4,-3);scene.add(rim);
 const person=new T.Group();scene.add(person);const materials=new Map();
 function mat(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.78,metalness:0}));return materials.get(color);}
 function mesh(geo,color,x,y,z,parent=person){const m=new T.Mesh(geo,mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function ball(c,x,y,z,sx,sy=sx,sz=sx,p=person){const m=mesh(new T.SphereGeometry(1,24,18),c,x,y,z,p);m.scale.set(sx,sy,sz);return m;}
 function box(c,x,y,z,sx,sy,sz,p=person){return mesh(new T.BoxGeometry(sx,sy,sz),c,x,y,z,p);}
 function cone(c,x,y,z,r,h,p=person){return mesh(new T.ConeGeometry(r,h,32),c,x,y,z,p);}
 function tube(c,points,r=.025,p=person){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),24,r,8,false),c,0,0,0,p);}
 function ring(c,x,y,z,r=.2,p=person){return mesh(new T.TorusGeometry(r,.025,8,32),c,x,y,z,p);}
 const skin=palettes.skin[config.skin]||'#f5c3a0',hair=palettes.hairColor[config.hairColor]||'#53372b',cloth=palettes.outfitColor[config.outfitColor]||'#8961ca';
 const headScale={round:[.73,.74,.65],oval:[.64,.83,.64],heart:[.73,.77,.61],square:[.76,.68,.63],soft:[.82,.73,.7]}[config.faceShape]||[.73,.74,.65];
 // A soft toy figure with separate head, limbs and clothing, fully modeled in 3D.
 ball('#ded0ea',0,.02,0,1.02,.12,.78);const shoe={navy:'#353347',white:'#f7f5ec',pink:'#df88b0',brown:'#795440',red:'#bf4154',mint:'#70b6a5'}[config.shoeColor]||'#353347';[-1,1].forEach(sign=>{const x=sign*.22;ball(shoe,x,.19,.08,.22,.13,.3);if(config.shoes==='boots')box(shoe,x,.35,0,.32,.37,.34);if(config.shoes==='platform')box('#e4dfe8',x,.1,.08,.39,.15,.48);if(config.shoes==='sneakers'){box('#f6f3ee',x,.12,.1,.36,.055,.47);for(let y=0;y<3;y++)box('#f6f3ee',x,.30,.14-y*.08,.22,.018,.025);}if(config.shoes==='ballet')[-1,1].forEach(k=>ball('#edd1df',x+k*.055,.31,.2,.065,.025,.04));if(config.shoes==='sandals'){ball(skin,x,.23,.17,.14,.08,.19);box(shoe,x,.28,.22,.3,.055,.055);}});
 box('#59637e',-.22,.43,0,.28,.52,.3);box('#59637e',.22,.43,0,.28,.52,.3);
 let outfit=cloth;if(config.seasonOutfit==='ghost')outfit='#f5f0fa';if(config.seasonOutfit==='pumpkin')outfit='#ef8e28';if(['skeleton','vampirecape','witchrobe'].includes(config.seasonOutfit))outfit='#333045';
 ball(outfit,0,1.08,0,.57,.68,.38);ball(outfit,-.59,1.1,0,.17,.46,.19).rotation.z=-.22;ball(outfit,.59,1.1,0,.17,.46,.19).rotation.z=.22;
 ball(skin,-.67,.74,.06,.16,.18,.15);ball(skin,.67,.74,.06,.16,.18,.15);ball(skin,0,1.68,0,.2,.2,.22);
 const head=new T.Group();head.position.y=2.38;person.add(head);ball(skin,0,0,0,...headScale,head);ball(skin,-headScale[0],-.02,0,.13,.19,.14,head);ball(skin,headScale[0],-.02,0,.13,.19,.14,head);

 // Facial details follow the face surface, so oval/soft faces do not swallow the eyes.
 function faceZ(x,y){return headScale[2]*Math.sqrt(Math.max(.1,1-(x/headScale[0])**2-(y/headScale[1])**2));}
 const eye={small:.072,medium:.09,large:.112,sparkle:.127}[config.eyeSize]||.10;
 const spacing={close:.21,normal:.27,wide:.32}[config.eyeSpacing]||.27;
 [-1,1].forEach(sign=>{const x=sign*spacing,y=-.015,z=faceZ(x,y)+.018;
 if(config.expression==='wink'&&sign===1)tube('#50383d',[[x-.07,y-.01,z],[x,y+.022,z+.012],[x+.07,y-.01,z]],.018,head);
 else{ball('#382c38',x,y,z,eye,eye*1.25,.033,head);ball(({brown:'#6e4737',black:'#45353d',blue:'#658eaf',green:'#6c947a',purple:'#a081b5',amber:'#be965c'}[config.eyeColor]||'#6e4737'),x,y-.025,z+.027,eye*.65,eye*.72,.014,head);ball('#fff9ef',x-.025,y+.039,z+.043,eye*.28,eye*.3,.009,head);ball('#fff9ef',x+.024,y-.046,z+.042,.011,.012,.006,head);}
 if(!config.faceDetail||config.faceDetail==='blush')ball('#eaa0a2',sign*.41,-.17,faceZ(sign*.41,-.17)+.018,.11,.048,.012,head);
 if(config.eyebrows&&config.eyebrows!=='none'){const slope=config.eyebrows==='angry'?sign*.035:config.eyebrows==='worried'?-sign*.035:0;tube(hair,[[x-.085,.19-slope,faceZ(x-.085,.19)+.023],[x,.215,faceZ(x,.215)+.023],[x+.085,.19+slope,faceZ(x+.085,.19)+.023]],config.eyebrows==='thick'?.022:.014,head);}
 });
 const nose={button:[.041,.047,.032],small:[.03,.033,.022],round:[.055,.051,.038],pointed:[.038,.053,.041]}[config.nose]||[.041,.047,.032];ball(skin,0,-.13,faceZ(0,-.13)+.012,...nose,head);
 if(config.faceDetail==='freckles')[-1,1].forEach(sign=>{for(let i=0;i<3;i++){const x=sign*(.32+i*.06),y=-.17+(i%2)*.035;ball('#bb826d',x,y,faceZ(x,y)+.018,.012,.012,.006,head);}});
 if(config.faceDetail==='whiskers')[-1,1].forEach(sign=>{for(let i=0;i<3;i++)tube('#826269',[[sign*.33,-.15,faceZ(.33,-.15)+.02],[sign*.52,-.24+i*.07,faceZ(.52,-.2)+.02]],.009,head);});
 if(config.faceDetail==='star')mesh(new T.OctahedronGeometry(.065),'#f3d484',.43,-.17,faceZ(.43,-.17)+.025,head).scale.z=.18;
 if(config.faceDetail==='heart'){[-.023,.023].forEach(x=>ball('#df8da8',.42+x,-.16,faceZ(.42,-.16)+.02,.035,.034,.01,head));cone('#df8da8',.42,-.194,faceZ(.42,-.194)+.02,.043,.055,head).rotation.z=Math.PI;}
 const mouthZ=faceZ(0,-.29)+.014;
 if(config.expression==='surprise')ball('#aa6376',0,-.29,mouthZ,.039,.051,.012,head);
 else if(config.expression==='happy'){ball('#985568',0,-.28,mouthZ,.085,.06,.017,head);ball('#f5b6bf',0,-.31,mouthZ+.014,.052,.022,.008,head);}
 else tube('#a96174',[[-.065,-.27,mouthZ],[0,config.expression==='calm'?-.275:-.302,mouthZ+.01],[.065,-.27,mouthZ]],.013,head);
 if(config.hair!=='bald'){
  // Continuous scalp with a higher front hairline and a lower back, rather than a hemisphere covering the eyebrows.
  const vertices=[],indices=[],cols=64,rows=26;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols*Math.PI*2,front=(Math.cos(u)+1)/2,edge=2.32-1.28*Math.pow(front,2),v=.001+(j/rows)*edge;vertices.push(Math.sin(u)*Math.sin(v)*headScale[0]*1.07,Math.cos(v)*headScale[1]*1.07+.025,Math.cos(u)*Math.sin(v)*headScale[2]*1.07-.035);}
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const scalp=mesh(geo,hair,0,0,0,head);scalp.material.side=T.DoubleSide;
  function lock(points,width,depth){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),vs=[],ix=[],steps=24,sides=12;for(let j=0;j<=steps;j++){const t=j/steps,c=curve.getPoint(t),tangent=curve.getTangent(t),across=new T.Vector3(-tangent.y,tangent.x,0).normalize(),shape=Math.pow(Math.sin(Math.PI*(.055+t*.945)),.48);for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;vs.push(c.x+across.x*Math.cos(a)*width*shape,c.y+across.y*Math.cos(a)*width*shape,c.z+Math.sin(a)*depth*shape);}}for(let j=0;j<steps;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;ix.push(a,a+1,b,b,a+1,b+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex(ix);g.computeVertexNormals();mesh(g,hair,0,0,0,head);}
  const bangs=config.bangs||'classic';
  if(bangs==='classic'||bangs==='straight')for(let i=0;i<5;i++){const x=(i-2)*.18;lock([[x*.68,.69,.28],[x*.93,.52,.53],[x+.035,.32+(bangs==='classic'?Math.abs(i-2)*.025:0),.61],[x+.06,.26+(bangs==='classic'?Math.abs(i-2)*.035:0),.58]],.125,.065);}
  if(bangs==='side')for(let i=0;i<4;i++)lock([[-.31+i*.13,.69,.26],[-.03+i*.12,.53,.54],[.22+i*.10,.35,.59],[.38+i*.075,.23,.49]],.14,.065);
  if(bangs==='curtain')[-1,1].forEach(sign=>{for(let i=0;i<2;i++)lock([[sign*.055,.73,.2],[sign*(.23+i*.10),.54,.53],[sign*(.46+i*.08),.25,.52],[sign*(.57+i*.065),.06,.4]],.14,.065);});
  // Tapered side locks blend into the cap and frame the face without sausage-like ends.
  if(['bob','long','curl'].includes(config.hair))[-1,1].forEach(sign=>{for(let i=0;i<3;i++){const long=config.hair==='long',curl=config.hair==='curl';lock([[sign*(.52+i*.055),.52,-.10-i*.12],[sign*(.72+i*.025),.1,-.01-i*.12],[sign*(curl?.79:.74),long?-.55:-.30,-.02-i*.12],[sign*(curl?.64:.66),long?-.99:-.51,.06-i*.12]],.17,.22);}});
  if(config.hair==='bun'){ball(hair,0,.83,-.34,.30,.23,.27,head);tube(hair,[[-.2,.82,-.19],[0,.99,-.25],[.2,.84,-.24]],.07,head);}
  if(config.hair==='ponytail')lock([[.25,.58,-.54],[.46,.2,-.65],[.52,-.35,-.58],[.36,-.83,-.45]],.23,.23);
  if(config.hair==='pigtails')[-1,1].forEach(sign=>{lock([[sign*.65,.23,-.28],[sign*.87,-.04,-.24],[sign*.88,-.4,-.18],[sign*.74,-.66,-.05]],.23,.23);ball('#e4a1bf',sign*.75,.13,-.17,.115,.065,.12,head);});
  if(config.hair==='pixie')for(let i=0;i<3;i++)lock([[-.30+i*.19,.68,-.04],[-.13+i*.18,.78,.14],[.05+i*.16,.59,.38],[.15+i*.13,.40,.49]],.16,.075);
 }
 // Base clothes have distinct geometry, not just color swaps.
 if(config.clothing==='hoodie'){ring('#eee2ee',0,1.55,.31,.18).rotation.x=.7;tube('#e8dbea',[[-.14,1.5,.35],[-.12,1.14,.41]],.015);tube('#e8dbea',[[.14,1.5,.35],[.12,1.14,.41]],.015);box(cloth,0,.94,.35,.44,.2,.08);}
 if(['shirt','jacket','uniform'].includes(config.clothing)){box('#f8f2e7',0,1.23,.37,.25,.62,.055);[-.12,.12].forEach(x=>box('#f8f2e7',x,1.5,.31,.21,.2,.08).rotation.z=x<0?-.6:.6);[.94,1.15,1.34].forEach(y=>ball('#bcab98',0,y,.417,.025));}
 if(config.clothing==='overalls'){box('#667bac',0,1.05,.35,.6,.62,.08);[-.22,.22].forEach(x=>box('#667bac',x,1.42,.3,.1,.5,.08));}
 if(config.clothing==='dress'){const skirt=mesh(new T.CylinderGeometry(.42,.69,.66,48),cloth,0,.70,0);skirt.scale.z=.68;ring('#e9d6ec',0,.37,0,.68).rotation.x=Math.PI/2;ball(cloth,0,1.25,.1,.48,.42,.34);[-1,1].forEach(sign=>ball('#f5e9ed',sign*.095,1.49,.36,.12,.07,.035));}
 if(config.clothing==='sport')[-.4,.4].forEach(x=>box('#f4f4f5',x,1.13,.2,.07,.75,.13));
 if(config.clothing==='knit')for(let y=.85;y<1.4;y+=.1)tube(cloth,[[-.35,y,.31],[0,y-.03,.39],[.35,y,.31]],.016);
 function motif(key,parent,x,y,z,scale=1){
  const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
  const B=(c,x,y,z,sx,sy=sx,sz=sx)=>ball(c,x,y,z,sx,sy,sz,g),C=(c,x,y,z,r,h)=>cone(c,x,y,z,r,h,g),X=(c,x,y,z,sx,sy,sz)=>box(c,x,y,z,sx,sy,sz,g);
  if(['pumpkin','pumpkins','pumpkinbucket','lantern','pumpkinmask'].includes(key)){
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2;B('#ee8b27',Math.cos(a)*.13,0,Math.sin(a)*.13,.2,.27,.18);}X('#527b40',0,.3,0,.075,.18,.08);
   [-.11,.11].forEach(xx=>C('#4b3540',xx,.04,.28,.06,.12).rotation.z=Math.PI);tube('#503140',[[-.13,-.09,.28],[0,-.15,.32],[.13,-.09,.28]],.026,g);
   if(key==='pumpkinbucket')ring('#493642',0,.25,0,.28,g);if(key==='lantern')B('#fff5ae',0,-.06,.3,.055);
  }else if(key==='ghost'){
   B('#f4efff',0,.15,0,.28,.33,.23);C('#f4efff',0,-.1,0,.31,.55);[-.09,.09].forEach(xx=>B('#343047',xx,.18,.21,.045,.065,.02));B('#343047',0,.02,.23,.04,.055,.02);
  }else if(key==='spider'){
   B('#393147',0,0,0,.2,.16,.22);B('#54435f',0,.06,.2,.12);[-.05,.05].forEach(xx=>B('#f0b8b0',xx,.11,.31,.025));for(let s of [-1,1])for(let i=0;i<4;i++)tube('#45334e',[[s*.1,0,.1-i*.09],[s*.34,.13,.22-i*.15],[s*.49,-.12,.3-i*.19]],.022,g);
  }else if(key==='web'){
   for(let i=0;i<8;i++){let a=i*Math.PI/4;tube('#dfd5ee',[[0,0,0],[Math.cos(a)*.6,Math.sin(a)*.6,0]],.009,g);}for(let r of [.2,.4,.6]){let ps=[];for(let i=0;i<=8;i++){let a=i*Math.PI/4;ps.push([Math.cos(a)*r,Math.sin(a)*r,0]);}tube('#dfd5ee',ps,.009,g);}
  }else if(['bat','batmask'].includes(key)){
   B('#403146',0,0,0,.12,.22,.13);[-1,1].forEach(s=>{const wing=new T.Shape();wing.moveTo(0,0);wing.lineTo(s*.55,.26);wing.quadraticCurveTo(s*.46,-.1,s*.36,-.05);wing.quadraticCurveTo(s*.25,-.24,s*.14,-.09);wing.lineTo(0,-.12);mesh(new T.ExtrudeGeometry(wing,{depth:.055,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.02,bevelThickness:.02}), '#463750',0,0,0,g);});
  }else if(['skull','bones'].includes(key)){
   B('#e8e0d5',0,.08,0,.23,.25,.16);X('#e8e0d5',0,-.13,0,.28,.14,.2);[-.09,.09].forEach(xx=>B('#51424b',xx,.08,.14,.06,.075,.028));if(key==='bones')[-1,1].forEach(s=>{const b=X('#e8e0d5',0,-.27,-.03,.8,.08,.08);b.rotation.z=s*.5;});
  }else if(['candy','lollipop'].includes(key)){
   B('#ed97bf',0,0,0,.22,.22,.1);ring('#fff2c5',0,0,.1,.14,g);if(key==='lollipop')X('#fbecdb',0,-.35,0,.045,.5,.045);else[-1,1].forEach(s=>{const c=C('#bba1ef',s*.3,0,0,.16,.2);c.rotation.z=s*Math.PI/2;});
  }else if(key==='broom'){X('#87613c',0,.1,0,.045,1,.045);C('#d1a457',0,-.42,0,.22,.4).rotation.z=Math.PI;}
  else if(key==='wand'){X('#6a4b83',0,-.2,0,.05,.65,.05);const star=mesh(new T.OctahedronGeometry(.18),'#ffcf65',0,.22,0,g);star.scale.z=.25;}
  else if(key==='cauldron'){B('#403a53',0,0,0,.34,.3,.29);ring('#635773',0,.19,0,.28,g).rotation.x=Math.PI/2;B('#91c774',0,.2,0,.24,.035,.24);[-.1,.08].forEach(xx=>B('#aad987',xx,.39+xx,0,.06));[-.22,.22].forEach(xx=>B('#403a53',xx,-.28,0,.06));}
  else if(key==='spellbook'||key==='books'){X('#795295',0,0,0,.45,.57,.14);X('#f2dfb5',0,0,.075,.38,.47,.015);X('#84639e',0,0,.09,.31,.4,.02);B('#f0c769',0,0,.11,.065,.065,.02);}
  else if(key==='rose'||key==='flowers'){X('#4b9567',0,-.25,0,.035,.5,.035);for(let i=0;i<6;i++){let a=i*Math.PI/3;B(key==='rose'?'#57334d':'#eb91b1',Math.cos(a)*.1,Math.sin(a)*.1,0,.12,.12,.07);}B('#efc765',0,0,.06,.05);}
  else if(key==='tombstone'){B('#92939f',0,.2,0,.27,.23,.1);X('#92939f',0,-.04,0,.54,.5,.2);X('#c0b8ce',0,.13,.11,.045,.25,.025);X('#c0b8ce',0,.17,.11,.2,.045,.025);}
  else if(key==='candles'){[-.2,0,.2].forEach((xx,i)=>{X('#eee3c2',xx,i*.07,0,.12,.45,.12);B('#ffc75b',xx,.3+i*.07,0,.055,.13,.055);});}
  else if(key==='crow'){B('#373444',0,0,0,.17,.22,.15);B('#373444',0,.25,0,.12);C('#c89b5b',.13,.25,.04,.055,.18).rotation.z=-Math.PI/2;B('#ede5dd',.06,.28,.1,.025);}
  else if(key==='moon'){B('#f6db92',0,0,0,.42,.42,.07);B('#d9be7e',-.1,.1,.06,.09,.08,.02);}
  else if(key==='hauntedhouse'){X('#5b4776',0,0,0,.62,.64,.3);C('#342d49',0,.48,0,.5,.38);[-.18,.18].forEach(xx=>X('#f7ce74',xx,.08,.16,.13,.16,.02));X('#302b3f',0,-.2,.16,.16,.23,.02);}
  else if(key==='stars'){for(let i=0;i<3;i++)mesh(new T.OctahedronGeometry(.12+i*.025),'#f4ca68',(i-1)*.28,Math.sin(i)*.2,0,g);}
  else if(key==='clouds'){[-.2,0,.2].forEach(xx=>B('#fff9ff',xx,xx===0?.1:0,0,.21,.17,.1));}
  else if(key==='balloons'){[-.2,0,.2].forEach((xx,i)=>{B(['#ee9bbc','#8bcbb8','#b4a0e4'][i],xx,i*.15,0,.17,.23,.14);tube('#b4a7bb',[[xx,-.22+i*.15,0],[0,-.6,0]],.009,g);});}
  else if(key==='plant'){C('#cb9074',0,-.16,0,.21,.3);[-1,1].forEach(s=>B('#65a979',s*.11,.15,0,.09,.27,.045).rotation.z=s*.4);}
  else if(key==='hearts'){[-.09,.09].forEach(xx=>B('#dc89af',xx,.08,0,.14,.13,.06));C('#dc89af',0,-.05,0,.19,.29).rotation.z=Math.PI;}
  return g;
 }
 if(config.seasonOutfit==='skeleton'){box('#e8ded6',0,1.14,.39,.075,.7,.035);for(let y=.96;y<1.5;y+=.13)box('#e8ded6',0,y,.4,.46,.045,.025);}
 if(['witchrobe','vampirecape'].includes(config.seasonOutfit)){const cape=cone(config.seasonOutfit==='witchrobe'?'#634486':'#773044',0,1.1,-.15,.78,1.45);cape.scale.z=.58;person.remove(cape);person.add(cape);}
 if(config.seasonOutfit==='striped')for(let y=.8;y<1.45;y+=.15)box('#dab775',0,y,.39,.72,.06,.035);
 if(config.seasonOutfit==='pumpkin')motif('pumpkinmask',person,0,1.08,.37,.55);
 if(config.seasonOutfit==='ghost')[-.12,.12].forEach(x=>ball('#423b51',x,1.15,.37,.045,.07,.025));
 function glasses(color){[-.26,.26].forEach(x=>ring(color,x,2.42,.68,.2));box(color,0,2.42,.68,.15,.035,.035);}
 if(config.accessory==='glasses'||config.seasonFace==='roundglasses')glasses('#b393cc');
 if(config.accessory==='sunglasses')[-.26,.26].forEach(x=>ball('#242838',x,2.42,.66,.22,.14,.05));
 if(config.accessory==='headphones'){ring('#7c6da1',0,2.5,0,.83);[-.77,.77].forEach(x=>ball('#9281b8',x,2.4,0,.12,.26,.22));}
 if(config.accessory==='bow')[-.14,.14].forEach(x=>ball('#e292b3',x,3.14,.12,.18,.11,.08));
 if(config.accessory==='cap'){ball('#748bca',0,3,0,.71,.2,.6);ball('#748bca',0,2.99,.64,.53,.045,.35);}
 if(config.accessory==='beanie')ball('#c49aab',0,3.02,0,.72,.38,.61);
 if(config.accessory==='crown')for(let i=0;i<5;i++)cone('#eac562',(i-2)*.2,3.2,.1,.12,.36);
 const h=config.seasonHat;
 if(h==='witch'){ball('#4b356b',0,3.1,0,.98,.07,.79);cone('#634389',0,3.53,0,.58,.91);mesh(new T.CylinderGeometry(.5,.55,.12,32),'#de943e',0,3.2,0);}
 if(h==='top'){mesh(new T.CylinderGeometry(.45,.45,.61,32),'#392b51',0,3.37,0);ball('#392b51',0,3.1,0,.82,.06,.66);}
 if(h==='cat'||h==='horns')[-1,1].forEach(s=>cone(h==='cat'?'#3d354c':'#b44e63',s*.57,3.15,0,.18,.56).rotation.z=s*-.18);
 if(h==='pumpkin')motif('pumpkin',person,0,3.25,0,1.35);
 if(h==='ghost')motif('ghost',person,0,3.25,0,.9);
 if(['bat','skull','spider','moon'].includes(h))motif(h,person,0,3.19,.1,.8);
 if(config.seasonFace==='batmask')motif('batmask',person,0,2.41,.67,.95);
 if(config.seasonFace==='eyepatch'){ball('#353045',-.26,2.42,.68,.18,.15,.025);tube('#353045',[[-.7,2.6,.1],[-.26,2.45,.69],[.7,2.3,.1]],.025);}
 if(config.seasonFace==='fangs')[-.07,.07].forEach(x=>cone('#fff4e1',x,2.1,.66,.035,.13).rotation.z=Math.PI);
 if(config.seasonFace==='stitches'){tube('#695360',[[.34,2.14,.57],[.51,2.23,.5]],.013);[.37,.43,.49].forEach(x=>tube('#695360',[[x,2.13+(x-.34)*.5,.59],[x,2.22+(x-.34)*.5,.58]],.011));}
 if(config.seasonFace==='pumpkinmask')motif('pumpkinmask',person,0,2.38,.57,1.55);
 if(config.seasonHand!=='none')motif(config.seasonHand,person,.88,1.1,.22,.95);
 if(config.backgroundProp!=='none')motif(config.backgroundProp,scene,-1.34,1.4,-.4,.9);
 if(config.seasonBackground!=='none'){
  motif(config.seasonBackground,scene,1.35,config.seasonBackground==='moon'?3.2:1.8,-.65,.9);
  if(['bat','pumpkins','candles','bones'].includes(config.seasonBackground))motif(config.seasonBackground,scene,-1.3,.55,-.6,.65);
 }

// Independently combinable jewelry, everyday props and companions.
if(config.earrings&&config.earrings!=='none')[-1,1].forEach(sign=>{let x=sign*(headScale[0]+.035);if(config.earrings==='hoop')ring('#e4bd63',x,2.14,.12,.10);else if(config.earrings==='pearl')ball('#f8ebdf',x,2.17,.14,.075);else if(config.earrings==='gem')mesh(new T.OctahedronGeometry(.095),'#8a8fda',x,2.17,.14);else if(config.earrings==='star')motif('stars',person,x,2.14,.14,.28);else {tube('#ddb661',[[x,2.2,.12],[x,1.99,.12]],.015);ball('#91bfd9',x,1.98,.12,.065,.10,.04);}});
if(config.neckwear==='scarf'){ring('#d79caa',0,1.64,0,.23).rotation.x=Math.PI/2;box('#d79caa',.19,1.35,.37,.15,.55,.06);}
if(config.neckwear==='bowtie')[-1,1].forEach(sign=>ball('#604a78',sign*.10,1.52,.35,.12,.07,.035));
if(config.neckwear==='tie'){box('#514371',0,1.34,.40,.09,.40,.025);cone('#514371',0,1.10,.40,.08,.16).rotation.z=Math.PI;}
if(config.neckwear==='pendant'){tube('#d8ba67',[[-.19,1.60,.2],[0,1.34,.4],[.19,1.60,.2]],.013);mesh(new T.OctahedronGeometry(.085),'#e9bf66',0,1.3,.43);}
if(config.neckwear==='headset'){ring('#595678',0,1.54,.04,.28).rotation.x=Math.PI/2;[-.27,.27].forEach(x=>ball('#9c95c9',x,1.45,.22,.10,.16,.10));}
if(config.handProp&&config.handProp!=='none'){
 const g=new T.Group();g.position.set(-.87,.88,.3);person.add(g);
 if(config.handProp==='coffee'){mesh(new T.CylinderGeometry(.13,.10,.28,24),'#eee0c9',0,.05,0,g);ring('#a27757',0,.2,0,.11,g).rotation.x=Math.PI/2;ring('#eee0c9',-.16,.05,0,.08,g);}
 else if(config.handProp==='phone'){box('#424555',0,.08,0,.22,.37,.055,g);box('#96c7d9',0,.09,.03,.18,.28,.01,g);}
 else if(config.handProp==='bag'){box('#bd9271',0,0,0,.36,.31,.16,g);ring('#8e6248',0,.23,0,.12,g);}
 else motif({book:'books',flower:'flowers',star:'wand',heart:'hearts'}[config.handProp],g,0,.1,0,.7);
}
if(config.pet&&config.pet!=='none'){
 const g=new T.Group();g.position.set(1.12,.28,.2);scene.add(g);const col={cat:'#9b8aaf',dog:'#b68d65',rabbit:'#f2e5ee',bear:'#967158',chick:'#ead16e'}[config.pet];
 ball(col,0,.08,0,.25,.27,.21,g);ball(col,0,.40,0,.26,.24,.23,g);[-1,1].forEach(sign=>{ball('#302b39',sign*.085,.42,.215,.027,.037,.015,g);ball(col,sign*.14,-.12,.10,.10,.07,.13,g);if(config.pet==='rabbit')ball(col,sign*.13,.77,0,.075,.25,.07,g);else if(config.pet==='cat')cone(col,sign*.17,.64,0,.09,.22,g);else if(config.pet!=='chick')ball(col,sign*.24,.52,0,.11,config.pet==='dog'?.2:.11,.09,g);});
 if(config.pet==='chick')cone('#df9042',0,.31,.25,.065,.13,g).rotation.x=Math.PI/2;else ball('#70515b',0,.32,.235,.035,.025,.02,g);
}

 const ground=mesh(new T.CircleGeometry(8,64),palettes.background[config.background],0,-.09,0,scene);ground.rotation.x=-Math.PI/2;if(options.transparent)ground.visible=false;
 function draw(){renderer.render(scene,camera);}draw();
 let down=false,start=0,angle=0;renderer.domElement.onpointerdown=e=>{down=true;start=e.clientX;angle=person.rotation.y;renderer.domElement.setPointerCapture(e.pointerId);};renderer.domElement.onpointermove=e=>{if(down){person.rotation.y=angle+(e.clientX-start)*.012;draw();}};renderer.domElement.onpointerup=()=>{down=false;};renderer.domElement.onpointercancel=()=>{down=false;};
 return {front(){person.rotation.y=0;draw();},rotate(delta){person.rotation.y+=delta;draw();},thumbnail(){const angle=person.rotation.y;person.rotation.y=0;draw();const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.drawImage(renderer.domElement,0,0,128,128);if(!options.transparent){ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(4,104,32,20,7);ctx.fill();ctx.fillStyle='#493757';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText(config.initial,20,119);}person.rotation.y=angle;draw();return c.toDataURL('image/png');},dispose(){scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}

