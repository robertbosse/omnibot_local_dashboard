import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from 'koa-cors';
import serve from 'koa-static';
import path from 'path';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { serverActor, getSnapshot } from './store';

const app = new Koa();
const router = new Router();

app.use(cors());
app.use(bodyParser());

// --- 1. DEBUGGING: Log every request ---
app.use(async (ctx, next) => {
	console.log(`[HTTP] ${ctx.method} ${ctx.url}`);
	await next();
});

// --- 2. STATIC FILES ---
// In Docker, WORKDIR is /app. We expect the UI at /app/dashboard/dist
const dashboardPath = path.join(process.cwd(), 'dashboard/dist');
console.log(`📂 Serving static files from: ${dashboardPath}`);

if (fs.existsSync(dashboardPath)) {
	const files = fs.readdirSync(dashboardPath);
	console.log(`✅ Dashboard directory exists. Contents:`, files);

	if (!files.includes('index.html')) {
		console.error(`❌ WARNING: index.html is missing! The build might have failed.`);
	}
} else {
	console.error(`❌ ERROR: Dashboard directory does not exist at ${dashboardPath}`);
}

// Serve static assets (JS, CSS, Images)
app.use(serve(dashboardPath));

// --- 3. API ROUTES ---
router.post('/api/telemetry', (ctx) => {
	serverActor.send({ type: 'TELEMETRY_RECEIVED', payload: ctx.request.body });
	ctx.status = 202;
});

router.post('/api/feedback', (ctx) => {
	serverActor.send({ type: 'FEEDBACK_RECEIVED', payload: ctx.request.body });
	ctx.status = 200;
});

router.post('/dashboard/push', (ctx) => {
	serverActor.send({ type: 'PUSH_NOTIFICATION', notification: ctx.request.body });
	ctx.status = 200;
});

router.get('/dashboard/state', (ctx) => {
	const snap = getSnapshot();
	ctx.body = {
		telemetry: snap.telemetry,
		feedback: snap.feedback,
		activeSubscribers: snap.subscribers.length,
	};
});

app.use(router.routes()).use(router.allowedMethods());

// --- 4. SPA FALLBACK (The Fix) ---
// If the request wasn't an API call and wasn't found by koa-static,
// serve index.html. This fixes "Not Found" for the root "/" and sub-paths.
app.use(async (ctx) => {
	if (ctx.status === 404 && ctx.method === 'GET') {
		// Ensure we don't accidentally serve HTML for a missing API call
		if (ctx.url.startsWith('/api')) {
			ctx.body = { error: 'API Endpoint not found' };
			return;
		}

		const indexPath = path.join(dashboardPath, 'index.html');
		if (fs.existsSync(indexPath)) {
			console.log('[SPA] Serving index.html fallback');
			ctx.type = 'html';
			ctx.body = fs.createReadStream(indexPath);
		} else {
			console.log('[SPA] CRITICAL: index.html not found!');
			ctx.body = 'Dashboard not built or missing index.html';
		}
	}
});

const HTTP_PORT = 4100;
app.listen(HTTP_PORT, () => {
	console.log(`🌍 Dashboard running at http://localhost:${HTTP_PORT}`);
});

// --- gRPC Server ---
const PROTO_PATH = path.join(__dirname, 'notifications.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	defaults: true,
	oneofs: true,
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

const grpcServer = new grpc.Server();

grpcServer.addService(protoDescriptor.omnibot.notifications.NotificationService.service, {
	SubscribeToNotifications: (call: any) => {
		serverActor.send({ type: 'SUBSCRIBER_CONNECTED', stream: call });
		call.on('cancelled', () => {
			serverActor.send({ type: 'SUBSCRIBER_DISCONNECTED', stream: call });
		});
	},
});

grpcServer.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
	console.log(`⚡ gRPC Server running at 0.0.0.0:50051`);
	//grpcServer.start();
});
