import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import serve from 'koa-static';
import path from 'path';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { serverActor, getSnapshot } from './store';

const app = new Koa();
const router = new Router();

router.get('/ping', (ctx) => {
	ctx.body = 'pong';
});

app.use(cors());
app.use(bodyParser());

// --- 1. COMPREHENSIVE REQUEST LOGGING ---
app.use(async (ctx, next) => {
	const start = Date.now();
	console.log(`\n>>> [${ctx.method}] ${ctx.url}`);

	await next();

	const ms = Date.now() - start;
	console.log(
		`<<< [${ctx.method}] ${ctx.url} - Status: ${ctx.status} (${ms}ms) - Body set: ${!!ctx.body}`
	);
});

// --- 2. API ROUTES (BEFORE STATIC FILES) ---
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

// DEBUG ROUTE
router.get('/debug/files', (ctx) => {
	console.log('🔍 DEBUG ROUTE HIT!');
	const dashboardPath = path.join(process.cwd(), 'dashboard/dist');
	ctx.body = {
		dashboardPath,
		exists: fs.existsSync(dashboardPath),
		files: fs.existsSync(dashboardPath) ? fs.readdirSync(dashboardPath) : [],
		assetsFiles: fs.existsSync(path.join(dashboardPath, 'assets'))
			? fs.readdirSync(path.join(dashboardPath, 'assets'))
			: [],
		indexHtmlExists: fs.existsSync(path.join(dashboardPath, 'index.html')),
		cwd: process.cwd(),
	};
});

console.log(
	'📋 Registered routes:',
	router.stack.map((layer) => `${layer.methods.join(',')} ${layer.path}`)
);

console.log('🔧 About to register routes...');
app.use(router.routes()).use(router.allowedMethods());
console.log('✅ Routes registered successfully');

// REGISTER ROUTES MIDDLEWARE
app.use(router.routes()).use(router.allowedMethods());

// --- 3. STATIC FILES (AFTER ROUTES) ---
const dashboardPath = path.join(process.cwd(), 'dashboard/dist');
console.log(`📂 Dashboard path: ${dashboardPath}`);

if (fs.existsSync(dashboardPath)) {
	const files = fs.readdirSync(dashboardPath);
	console.log(`✅ Files in dashboard:`, files);

	const assetsPath = path.join(dashboardPath, 'assets');
	if (fs.existsSync(assetsPath)) {
		const assets = fs.readdirSync(assetsPath);
		console.log(`✅ Files in assets (${assets.length}):`, assets);
	}
} else {
	console.error(`❌ Dashboard path does not exist!`);
}

// Serve static files - this will serve index.html, assets, etc.
app.use(serve(dashboardPath));

// --- 4. SPA FALLBACK (LAST) ---
app.use(async (ctx) => {
	// Only handle GET requests
	if (ctx.method !== 'GET') return;

	// Skip if already handled (body is set)
	if (ctx.body) return;

	// Skip API routes (shouldn't get here, but just in case)
	if (ctx.url.startsWith('/api') || ctx.url.startsWith('/dashboard')) return;

	// Serve index.html for all other routes (SPA fallback)
	const indexPath = path.join(dashboardPath, 'index.html');
	console.log(`[SPA Fallback] Serving index.html for: ${ctx.url}`);

	if (fs.existsSync(indexPath)) {
		ctx.type = 'html';
		ctx.body = fs.createReadStream(indexPath);
	} else {
		console.error('[SPA] CRITICAL: index.html not found!');
		ctx.status = 404;
		ctx.body = 'Dashboard not found';
	}
});

const HTTP_PORT = 4100;
app.listen(HTTP_PORT, '0.0.0.0', () => {
	console.log(`🌍 Dashboard running at http://0.0.0.0:${HTTP_PORT}`);
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
