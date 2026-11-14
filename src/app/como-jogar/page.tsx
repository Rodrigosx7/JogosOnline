import { TrucoTutorial } from '../../components/TrucoTutorial';

export default function HowToPlayPage() {
  return (
    <main className="standalone-tutorial-page">
      <a className="standalone-tutorial-back" href="/">← Voltar ao início</a>
      <TrucoTutorial />
    </main>
  );
}
