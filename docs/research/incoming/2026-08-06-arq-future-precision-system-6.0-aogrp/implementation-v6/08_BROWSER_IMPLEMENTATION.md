# Browser implementation

Use a dedicated worker. Preflight with bounded slices. Use Blob or File range reads and stream segments. Materialise only required semantic objects into the chosen local index. Safari fallback must avoid unsupported sync access assumptions. Publication creates a separate Blob or file candidate and verifies it with a fresh reader before user delivery.
