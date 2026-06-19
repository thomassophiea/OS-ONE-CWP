export default function AcceptButton({ sessionId }: { sessionId: string }) {
  return (
    <form method="POST" action="/api/accept">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
      >
        I Accept — Continue to Internet
      </button>
    </form>
  );
}
