/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';

export default function App() {
	const [data, setData] = useState({ telemetry: [], feedback: [], activeSubscribers: 0 });
	const [notif, setNotif] = useState({
		title: 'Hello Dev',
		body: 'This is a push notification!',
		kind: 'info',
	});

	// Poll for dashboard data (telemetry/feedback)
	useEffect(() => {
		const interval = setInterval(() => {
			fetch('/dashboard/state')
				.then((r) => r.json())
				.then(setData);
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	const triggerPush = async () => {
		await fetch('/dashboard/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...notif, id: Date.now().toString() }),
		});
	};

	return (
		<div
			style={{
				padding: 20,
				fontFamily: 'sans-serif',
				background: '#1e1e1e',
				color: '#eee',
				minHeight: '100vh',
			}}
		>
			<h1 style={{ color: '#61dafb' }}>Omnibot Command Center</h1>

			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
				{/* Push Controls */}
				<div style={{ background: '#252526', padding: 15, borderRadius: 8 }}>
					<h2>🚀 Push Notification</h2>
					<div style={{ marginBottom: 10 }}>
						<strong>Active Streams: </strong>
						<span style={{ color: data.activeSubscribers > 0 ? '#4caf50' : '#f44336' }}>
							{data.activeSubscribers} VS Code instance(s) connected
						</span>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<input
							placeholder="Title"
							value={notif.title}
							onChange={(e) => setNotif({ ...notif, title: e.target.value })}
							style={{ padding: 8, background: '#3c3c3c', border: 'none', color: 'white' }}
						/>
						<textarea
							placeholder="Body"
							value={notif.body}
							onChange={(e) => setNotif({ ...notif, body: e.target.value })}
							style={{
								padding: 8,
								background: '#3c3c3c',
								border: 'none',
								color: 'white',
								height: 60,
							}}
						/>
						<button
							onClick={triggerPush}
							style={{
								padding: 10,
								background: '#0e639c',
								color: 'white',
								border: 'none',
								cursor: 'pointer',
							}}
						>
							PUSH NOW
						</button>
					</div>
				</div>

				{/* Feedback Log */}
				<div style={{ background: '#252526', padding: 15, borderRadius: 8 }}>
					<h2>💬 Feedback</h2>
					<div style={{ height: 200, overflowY: 'auto' }}>
						{data.feedback.map((f: any, i) => (
							<div key={i} style={{ borderBottom: '1px solid #444', padding: 5 }}>
								<strong>{f.kind}:</strong> {f.message}
							</div>
						))}
					</div>
				</div>

				{/* Telemetry Log */}
				<div style={{ background: '#252526', padding: 15, borderRadius: 8, gridColumn: 'span 2' }}>
					<h2>📡 Telemetry Stream</h2>
					<div style={{ height: 300, overflowY: 'auto', fontFamily: 'monospace' }}>
						{data.telemetry.map((t: any, i) => (
							<div key={i} style={{ borderBottom: '1px solid #444', padding: 4 }}>
								<span style={{ color: '#888' }}>{new Date(t.timestamp).toLocaleTimeString()}</span>
								<span style={{ color: '#4ec9b0', marginLeft: 10 }}>{t.name}</span>
								<span style={{ color: '#ce9178', marginLeft: 10 }}>{JSON.stringify(t.props)}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
