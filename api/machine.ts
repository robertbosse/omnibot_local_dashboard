import { setup, assign } from 'xstate';
import { ServerWritableStream } from '@grpc/grpc-js';

export interface ServerContext {
	telemetry: any[];
	feedback: any[];
	subscribers: ServerWritableStream<any, any>[];
}

export type ServerEvent =
	| { type: 'TELEMETRY_RECEIVED'; payload: any }
	| { type: 'FEEDBACK_RECEIVED'; payload: any }
	| { type: 'SUBSCRIBER_CONNECTED'; stream: ServerWritableStream<any, any> }
	| { type: 'SUBSCRIBER_DISCONNECTED'; stream: ServerWritableStream<any, any> }
	| { type: 'PUSH_NOTIFICATION'; notification: any };

export const serverMachine = setup({
	types: { context: {} as ServerContext, events: {} as ServerEvent },
	actions: {
		broadcastToSubscribers: ({ context, event }) => {
			if (event.type !== 'PUSH_NOTIFICATION') return;
			console.log(`🚀 Broadcasting to ${context.subscribers.length} subscribers`);
			context.subscribers.forEach((stream) => {
				try {
					stream.write(event.notification);
				} catch (err) {
					console.error('Stream error', err);
				}
			});
		},
		logEvent: ({ event }) => console.log(`[XState] ${event.type}`),
	},
}).createMachine({
	id: 'omnibot-server',
	initial: 'active',
	context: { telemetry: [], feedback: [], subscribers: [] },
	states: {
		active: {
			on: {
				TELEMETRY_RECEIVED: {
					actions: [
						'logEvent',
						assign({
							telemetry: ({ context, event }) =>
								[{ ...event.payload, timestamp: new Date() }, ...context.telemetry].slice(0, 500),
						}),
					],
				},
				FEEDBACK_RECEIVED: {
					actions: [
						'logEvent',
						assign({
							feedback: ({ context, event }) => [
								{ ...event.payload, timestamp: new Date() },
								...context.feedback,
							],
						}),
					],
				},
				SUBSCRIBER_CONNECTED: {
					actions: [
						'logEvent',
						assign({
							subscribers: ({ context, event }) => [...context.subscribers, event.stream],
						}),
					],
				},
				SUBSCRIBER_DISCONNECTED: {
					actions: [
						'logEvent',
						assign({
							subscribers: ({ context, event }) =>
								context.subscribers.filter((s) => s !== event.stream),
						}),
					],
				},
				PUSH_NOTIFICATION: { actions: ['logEvent', 'broadcastToSubscribers'] },
			},
		},
	},
});
