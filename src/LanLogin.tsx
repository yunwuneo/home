import { useState } from 'react';
import { Home, KeyRound, LoaderCircle, ArrowRight } from 'lucide-react';
import { api } from './api';

export default function LanLogin({ onPaired }: { onPaired: () => void }) {
  const [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/session', { code });
      onPaired();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="pairing-page">
      <div className="brand-mark">
        <Home size={28} />
      </div>
      <h1>和 Echo 的家</h1>
      <form onSubmit={submit} className="pairing-form">
        <KeyRound size={25} />
        <h2>配对这台设备</h2>
        <label>
          配对码
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            required
            autoFocus
          />
        </label>
        <p>在服务器电脑上打开小家，在设置中生成配对码。</p>
        <div className="form-feedback error" role="alert">
          {error}
        </div>
        <button className="primary" disabled={busy || code.length !== 6}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}进入小家
        </button>
      </form>
    </main>
  );
}
