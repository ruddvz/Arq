# Security and hostile packs

Custom formats introduce parser risk. AOGRP readers must bound file size, segment count, nesting, decompression ratio, object count, string length, reference fanout, recursion depth, memory, CPU, and external resolution. Hash verification occurs before interpretation where possible. Codecs and domain packs are allowlisted. Unknown required codecs block deep open. Parsing runs in isolated workers.
