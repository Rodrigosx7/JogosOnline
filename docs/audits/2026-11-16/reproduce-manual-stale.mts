import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createRoom,applyCommand} from '../../../src/lib/game';
import {defaultCustomConfig} from '../../../src/lib/custom-mode';
import {FileRoomStore} from '../../../src/lib/server/storage';
import {accessRoom} from '../../../src/lib/server/rooms';
const now=Date.now();let room=createRoom('audit-delayed-pull-20261116','1x1');
for(const id of ['audit-a','audit-b'])room=applyCommand(room,id,{type:'join',name:id},now);
for(const id of ['audit-a','audit-b'])room=applyCommand(room,id,{type:'ready'},now);
room.custom={config:defaultCustomConfig(),scoreMode:'manual'};
const delayed={command:{type:'pull',amount:3,matchId:room.matchId},revision:room.revision,requestId:'delayed-from-previous-hand'};
// Represent the same match after the previous window closed and a subsequent hand ended.
room.handNumber++;room.revision+=5;room.pullUntil=Date.now()+5000;room.pullLimit=3;room.pullUsed=[0,0];room.handStartedAt=room.pullUntil;room.deadline=room.pullUntil+30000;
const directory=await mkdtemp(path.join(os.tmpdir(),'truco-audit-proof-'));const store=new FileRoomStore(directory);await store.create(room.code,{state:room,requests:{}});
const result=await accessRoom(room.code,'audit-a',delayed,store);
const evidence={case:'delayed pull from previous hand',expected:'reject previous hand',actualStatus:result.status,appliedToHand:result.view.handNumber,scores:result.view.scores,oldRevision:delayed.revision,newRevision:room.revision};
await writeFile(new URL('./manual-stale-command.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(evidence);
