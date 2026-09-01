import { redirect } from 'next/navigation';

// (dashboard) is a route group — it adds no URL segment, so this file is what actually renders
// at '/' now that the legacy bank-demo page (app/page.js) is gone. Security Test is the natural
// default landing page (it's real, reuses the most existing logic, and needs no live data to be
// useful — unlike Live Activity/Audit Trail, which are empty until something has happened).
export default function DashboardHome() {
  redirect('/security-test');
}
