import { createActor } from 'xstate';
import { serverMachine } from './machine';

export const serverActor = createActor(serverMachine);
serverActor.start();
export const getSnapshot = () => serverActor.getSnapshot().context;
