/**
 * Assembling a server: the one function the Arq application calls.
 *
 * Everything the runtime needs is passed in - the host, the clock, the
 * identifier source, and the grant resolver. Nothing is reached for and
 * nothing defaults to something permissive. In particular there is no
 * default grant: an application that forgets to wire `resolveGrant` gets a
 * server whose every tool answers "nothing is shared with this connection",
 * which is the safe direction to fail in.
 *
 * The Arq application owns the two decisions this package deliberately does
 * not make: which projects a connection may see, and when a person has
 * approved a change. `resolveGrant` is the first. The second has no
 * parameter here at all, because the operator surface is a different object
 * and this factory never receives it.
 */

import type { AuditTrail } from '../audit/audit-trail';
import { createAuditTrail } from '../audit/audit-trail';
import { ArqBridge } from '../adapter/bridge-adapter';
import type { GrantContext } from '../grant/grant';
import type { ArqProjectHost } from '../host/project-host';
import type { ClientIdentity } from '../mcp/protocol';
import { createArqMcpServer, type ArqMcpServer } from '../mcp/server';
import type { DomainProfileRegistry } from '../profile/profile-registry';
import { createDefaultDomainProfileRegistry } from '../profile/profile-registry';
import { createToolService } from '../service/tool-service';
import { randomUUID } from 'node:crypto';
import { systemClock, type Clock, type IdSource } from './clock';

export interface ArqMcpRuntimeOptions {
  readonly host: ArqProjectHost;
  /**
   * Decides what this client may see. Called on every tool call rather than
   * once at connect time, so a grant the operator withdraws mid-session
   * stops working on the next call rather than at the next reconnection.
   */
  readonly resolveGrant: (client: ClientIdentity) => GrantContext | undefined;
  readonly registry?: DomainProfileRegistry;
  readonly clock?: Clock;
  readonly idSource?: IdSource;
  readonly audit?: AuditTrail;
  readonly serverMode?: 'local_runtime' | 'remote_gateway';
  readonly reportFault?: (error: unknown, traceId: string) => void;
}

export interface ArqMcpRuntime {
  readonly server: ArqMcpServer;
  readonly bridge: ArqBridge;
  readonly audit: AuditTrail;
}

export function createArqMcpRuntime(options: ArqMcpRuntimeOptions): ArqMcpRuntime {
  const clock = options.clock ?? systemClock;
  // Unpredictable by default. A sequential source is available for tests and
  // for an operator who has asked for reproducible logs, but it must not be
  // the default: guessable trace identifiers let one caller reference
  // another's activity.
  const idSource = options.idSource ?? (() => randomUUID());
  const audit = options.audit ?? createAuditTrail(clock);
  const registry = options.registry ?? createDefaultDomainProfileRegistry();

  const bridge = new ArqBridge({
    host: options.host,
    registry,
    clock,
    idSource,
    audit,
    serverMode: options.serverMode ?? 'local_runtime',
  });

  const service = createToolService({
    audit,
    nextTraceId: () => bridge.nextTraceId(),
    ...(options.reportFault === undefined ? {} : { reportFault: options.reportFault }),
  });

  const server = createArqMcpServer({
    bridge,
    service,
    resolveGrant: options.resolveGrant,
  });

  return { server, bridge, audit };
}
