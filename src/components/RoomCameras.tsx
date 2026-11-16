'use client';
import {useEffect,useRef,useState} from 'react';
type Camera={playerId:string;session:string;at:number};
type Signal={id:string;from:string;session:string;targetSession:string;sdp:RTCSessionDescriptionInit};
type Props={playerId:string;players:{id:string;name:string}[];cameras:Camera[];signals:Signal[];onSend:(c:Record<string,unknown>)=>Promise<unknown>};
function Video({stream,name,local=false}:{stream:MediaStream;name:string;local?:boolean}){
 const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{if(video.current){video.current.srcObject=stream;void video.current.play().catch(()=>{});}},[stream]);
 return <figure><video ref={video} autoPlay playsInline muted={local}/><figcaption>{name}{local?' (você)':''}</figcaption></figure>;
}
export function RoomCameras({playerId,players,cameras,signals,onSend}:Props){
 const [local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<Record<string,MediaStream>>({}),[error,setError]=useState(''),[starting,setStarting]=useState(false);
 const peers=useRef(new Map<string,{pc:RTCPeerConnection;session:string}>()),session=useRef(''),seen=useRef(new Set<string>()),stream=useRef<MediaStream|null>(null),send=useRef(onSend),queue=useRef(Promise.resolve());
 send.current=onSend;
 function closePeers(){peers.current.forEach(v=>v.pc.close());peers.current.clear();setRemote({});}
 function stop(){session.current='';stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setLocal(null);closePeers();}
 async function toggle(){
  if(local){const id=session.current;stop();void send.current({type:'camera',enabled:false,session:id});return;}
  setStarting(true);setError('');
  try{
   const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:320},height:{ideal:240},facingMode:'user'},audio:false});
   const id=crypto.randomUUID();session.current=id;stream.current=media;
   if(!await send.current({type:'camera',enabled:true,session:id})){stop();throw new Error('Não foi possível conectar a câmera.');}
   setLocal(media);
  }catch{setError('Não foi possível ativar a câmera. Confira a permissão no navegador.');}finally{setStarting(false);}
 }
 useEffect(()=>()=>{session.current='';stream.current?.getTracks().forEach(t=>t.stop());peers.current.forEach(v=>v.pc.close());},[]);
 useEffect(()=>{if(!local)return;const heartbeat=setInterval(()=>void send.current({type:'camera',enabled:true,session:session.current}),10000);return()=>clearInterval(heartbeat);},[local]);
 useEffect(()=>{
  if(!local)return;
  const ownSession=session.current;
  const cancelled=()=>!session.current||session.current!==ownSession;
  async function gather(pc:RTCPeerConnection){if(pc.iceGatheringState==='complete')return;await new Promise<void>(resolve=>{const done=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',done);resolve();}};const timer=setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);resolve();},6000);pc.addEventListener('icegatheringstatechange',done);});}
  async function connection(camera:Camera){
   const existing=peers.current.get(camera.playerId);if(existing?.session===camera.session)return existing.pc;
   existing?.pc.close();
   const response=await fetch('/api/camera-config');const config=await response.json();
   if(cancelled()||!stream.current)throw new Error('Câmera desligada');
   const pc=new RTCPeerConnection(config);peers.current.set(camera.playerId,{pc,session:camera.session});
   stream.current.getTracks().forEach(track=>pc.addTrack(track,stream.current!));
   pc.ontrack=event=>setRemote(old=>({...old,[camera.playerId]:event.streams[0]}));
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')setError('A conexão de vídeo falhou. Desligue e ligue a câmera para tentar novamente.');};
   return pc;
  }
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   if(cancelled())return;
   for(const [id,peer] of peers.current){if(!cameras.some(c=>c.playerId===id&&c.session===peer.session)){peer.pc.close();peers.current.delete(id);setRemote(old=>{const next={...old};delete next[id];return next;});}}
   for(const camera of cameras.filter(c=>c.playerId!==playerId)){
    if(cancelled())return;
    if(playerId<camera.playerId&&!peers.current.has(camera.playerId)){
     const pc=await connection(camera);await pc.setLocalDescription(await pc.createOffer());await gather(pc);
     if(!cancelled()&&session.current)await send.current({type:'camera-signal',to:camera.playerId,session:session.current,targetSession:camera.session,sdp:pc.localDescription?.toJSON()});
    }
   }
   for(const signal of signals){
    if(cancelled()||seen.current.has(signal.id)||signal.targetSession!==session.current)continue;
    const camera=cameras.find(c=>c.playerId===signal.from&&c.session===signal.session);if(!camera)continue;
    seen.current.add(signal.id);if(seen.current.size>128)seen.current.delete(seen.current.values().next().value!);
    const pc=await connection(camera);
    await pc.setRemoteDescription(signal.sdp);
    if(signal.sdp.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());await gather(pc);if(!cancelled()&&session.current)await send.current({type:'camera-signal',to:camera.playerId,session:session.current,targetSession:camera.session,sdp:pc.localDescription?.toJSON()});}
   }
  }).catch(()=>{if(!cancelled())setError('Não foi possível conectar o vídeo. Tente ativar novamente.');});
 },[local,cameras,signals,playerId]);
 return <section className="room-cameras" aria-label="Câmeras da mesa"><button className="button" disabled={starting} onClick={()=>void toggle()}>{starting?'Ativando câmera…':local?'Desligar câmera':'Ativar câmera'}</button><small>Vídeo para os jogadores com câmera ativa · sem microfone</small>{error&&<p role="alert">{error}</p>}<div className="camera-grid">{local&&<Video stream={local} name={players.find(p=>p.id===playerId)?.name??'Você'} local/>}{Object.entries(remote).map(([id,media])=><Video key={id} stream={media} name={players.find(p=>p.id===id)?.name??'Jogador'}/>)}</div></section>;
}
