'use client';
import {useEffect,useRef,useState} from 'react';
type Camera={playerId:string;session:string;at:number;live?:boolean};
type Signal={id:string;from:string;session:string;targetSession:string;sdp:RTCSessionDescriptionInit};
type Props={code:string;playerId:string;players:{id:string;name:string}[];cameras:Camera[];signals:Signal[];onSend:(c:Record<string,unknown>)=>Promise<boolean>;onStreams:(streams:Record<string,MediaStream>)=>void;viewerOnly?:boolean};
const live=(c:Camera)=>c.live!==false;
export function SeatCamera({stream,name,local=false}:{stream:MediaStream;name:string;local?:boolean}){
 const video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{if(video.current){video.current.srcObject=stream;void video.current.play().catch(()=>{});}},[stream]);
 return <div className="seat-camera"><video ref={video} aria-label={`Câmera de ${name}`} autoPlay playsInline muted={local}/></div>;
}
export function RoomCameras({code,playerId,players,cameras,signals,onSend,onStreams,viewerOnly=false}:Props){
 const [local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<Record<string,MediaStream>>({}),[error,setError]=useState(''),[starting,setStarting]=useState(false),[activeSession,setActiveSession]=useState('');
 const peers=useRef(new Map<string,{pc:RTCPeerConnection;session:string}>()),session=useRef(''),seen=useRef(new Set<string>()),stream=useRef<MediaStream|null>(null),send=useRef(onSend),queue=useRef(Promise.resolve());
 send.current=onSend;
 // Someone else is broadcasting: only then does a viewer need to register and receive offers.
 const othersLive=cameras.some(c=>c.playerId!==playerId&&live(c));
 const wanted=!!local||othersLive;
 useEffect(()=>{onStreams(local?{...remote,[playerId]:local}:remote);},[local,remote,playerId,onStreams]);
 function closePeers(){peers.current.forEach(v=>v.pc.close());peers.current.clear();setRemote({});}
 function drop(id:string){peers.current.get(id)?.pc.close();peers.current.delete(id);setRemote(old=>{if(!(id in old))return old;const next={...old};delete next[id];return next;});}
 function stop(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setLocal(null);}
 async function toggle(){
  if(local){stop();return;}
  setStarting(true);setError('');
  try{
   const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:320},height:{ideal:240},facingMode:'user'},audio:false});
   stream.current=media;setLocal(media);
  }catch{setError('Não foi possível ativar a câmera. Confira a permissão no navegador.');}finally{setStarting(false);}
 }
 useEffect(()=>()=>{session.current='';stream.current?.getTracks().forEach(t=>t.stop());peers.current.forEach(v=>v.pc.close());},[]);
 useEffect(()=>{
  if(!wanted){session.current='';setActiveSession('');closePeers();return;}
  const id=crypto.randomUUID();session.current=id;setActiveSession('');closePeers();
  let cancelled=false;
  const register=async()=>{if(await send.current({type:'camera',enabled:true,session:id,live:!!local})&&!cancelled)setActiveSession(id);};
  void register();const heartbeat=setInterval(()=>void register(),10000);
  return()=>{cancelled=true;clearInterval(heartbeat);if(session.current===id)session.current='';void send.current({type:'camera',enabled:false,session:id});};
 },[local,wanted]);
 useEffect(()=>{
  if(!activeSession)return;
  const ownSession=activeSession;
  const cancelled=()=>!session.current||session.current!==ownSession;
  async function gather(pc:RTCPeerConnection){if(pc.iceGatheringState==='complete')return;await new Promise<void>(resolve=>{const done=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',done);resolve();}};const timer=setTimeout(()=>{pc.removeEventListener('icegatheringstatechange',done);resolve();},6000);pc.addEventListener('icegatheringstatechange',done);});}
  async function connection(camera:Camera){
   const existing=peers.current.get(camera.playerId);if(existing?.session===camera.session)return existing.pc;
   existing?.pc.close();
   const response=await fetch(`/api/camera-config?room=${encodeURIComponent(code)}`);if(!response.ok)throw new Error('Configuração de vídeo indisponível');const config=await response.json();
   if(cancelled())throw new Error('Sessão encerrada');
   const pc=new RTCPeerConnection(config);peers.current.set(camera.playerId,{pc,session:camera.session});
   if(stream.current)stream.current.getTracks().forEach(track=>pc.addTrack(track,stream.current!));else pc.addTransceiver('video',{direction:'recvonly'});
   // A lost answer leaves the offer side waiting; give up after a while so it is offered again.
   setTimeout(()=>{if(pc.connectionState!=='connected'&&peers.current.get(camera.playerId)?.pc===pc){pc.close();peers.current.delete(camera.playerId);}},20000);
   pc.ontrack=event=>setRemote(old=>({...old,[camera.playerId]:event.streams[0]}));
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){if(peers.current.get(camera.playerId)?.pc===pc)peers.current.delete(camera.playerId);setError('A conexão de vídeo falhou. Tentando de novo…');}else if(pc.connectionState==='connected')setError('');};
   return pc;
  }
  const mine=!!stream.current;
  // Exactly one side offers: the broadcaster when only one transmits, otherwise the lower id.
  const offers=(camera:Camera)=>mine&&!live(camera)?true:!mine&&live(camera)?false:playerId<camera.playerId;
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   if(cancelled())return;
   for(const [id,peer] of peers.current)if(!cameras.some(c=>c.playerId===id&&c.session===peer.session))drop(id);
   // Two viewers without video have nothing to exchange.
   const partners=cameras.filter(c=>c.playerId!==playerId&&(mine||live(c)));
   for(const id of [...peers.current.keys()])if(!partners.some(c=>c.playerId===id))drop(id);
   for(const camera of partners){
    if(cancelled())return;
    if(offers(camera)&&!peers.current.has(camera.playerId)){
     try{
      const pc=await connection(camera);await pc.setLocalDescription(await pc.createOffer());await gather(pc);
      if(cancelled())return;
      // A lost offer is retried on the next update instead of leaving the peer stuck.
      if(!await send.current({type:'camera-signal',to:camera.playerId,session:ownSession,targetSession:camera.session,sdp:pc.localDescription?.toJSON()}))drop(camera.playerId);
     }catch{if(!cancelled())drop(camera.playerId);}
    }
   }
   for(const signal of signals){
    if(cancelled()||seen.current.has(signal.id)||signal.targetSession!==ownSession)continue;
    const camera=cameras.find(c=>c.playerId===signal.from&&c.session===signal.session);if(!camera)continue;
    try{
     const pc=await connection(camera);
     await pc.setRemoteDescription(signal.sdp);
     if(signal.sdp.type==='offer'){
      await pc.setLocalDescription(await pc.createAnswer());await gather(pc);
      if(cancelled())return;
      if(!await send.current({type:'camera-signal',to:camera.playerId,session:ownSession,targetSession:camera.session,sdp:pc.localDescription?.toJSON()})){drop(camera.playerId);continue;}
     }
     // Only a fully handled signal counts as seen, so a failure can be processed again.
     seen.current.add(signal.id);if(seen.current.size>128)seen.current.delete(seen.current.values().next().value!);
    }catch{if(!cancelled())drop(camera.playerId);}
   }
  }).catch(()=>{if(!cancelled())setError('Não foi possível conectar o vídeo. Tente ativar novamente.');});
 },[activeSession,local,cameras,signals,playerId,code]);
 const broadcasting=cameras.filter(c=>live(c)&&players.some(p=>p.id===c.playerId)).length;
 return <section className="room-cameras" aria-label="Câmeras da mesa">{!viewerOnly&&<button className="button" aria-pressed={!!local} disabled={starting} onClick={()=>void toggle()}>{starting?'Ativando câmera…':local?'Desligar câmera':'Ativar câmera'}</button>}<small aria-live="polite">{broadcasting?`${broadcasting} câmera(s) ligada(s)`:'Nenhuma câmera ligada'} · sem microfone</small>{error&&<p role="alert">{error}</p>}</section>;
}
