import { createApp } from 'vue';
import App from './ui/App.vue';
import { GameSession } from './session';
import { registerOffline } from './platform/offline';
import './ui/style.css';

const session = new GameSession();
const app = createApp(App, { session });
app.mount('#root');
session.start();
if (import.meta.env.PROD) void registerOffline(import.meta.env.BASE_URL);
if (import.meta.hot) import.meta.hot.dispose(() => { app.unmount(); session.dispose(); });
