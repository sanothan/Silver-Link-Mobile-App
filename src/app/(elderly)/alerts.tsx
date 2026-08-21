import type { Href } from 'expo-router';
import { ReportIssueScreen } from '../../components/ReportIssueScreen';
export default function Alerts() {
  return <ReportIssueScreen title="Alerts & Safety" message="Report a concern or safety issue to SilverLink support." homeHref={'/(elderly)' as Href} />;
}
