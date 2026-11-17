// Test helper: a connection mock that answers every `Get` the way a server does,
// with one Retrieved packet (keys -> value) delivered on the next microtask.
// `answer(key)` gives each key's value; the default, null, is what an upstream
// MultiServer sends for a key it does not have (an old server, an unknown game).

export function answerGets(connectionMock, getHandler, answer = () => null) {
  connectionMock.send.mockImplementation((packets) => {
    for (const packet of packets || []) {
      if (packet?.cmd !== 'Get' || !Array.isArray(packet.keys)) continue;
      const keys = Object.fromEntries(packet.keys.map((key) => [key, answer(key)]));
      queueMicrotask(() => getHandler()?.processMessage({ cmd: 'Retrieved', keys }));
    }
    return true;
  });
}
