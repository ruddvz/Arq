# @arq/command-system

The command lifecycle state machine (ARQ-038): armed → previewing →
awaiting-input → committed/failed-safely, with the three-tier Escape rule and
the "commits only a valid preview" contract every drawing tool builds on (see
`@arq/editor-shell`'s wall/door/window/room tools).

The command _palette_ UI lives in `@arq/design-system` and the keyboard map
in `@arq/workspace` - this package is deliberately just the lifecycle
contract, which is why its name is currently wider than its contents.
