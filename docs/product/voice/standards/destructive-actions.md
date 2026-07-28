# Destructive and irreversible action language

Professional authoring tools must make destructive scope explicit before commitment.

## Consequence preview

Before a destructive operation show, when known:

1. object being changed/deleted;
2. dependent objects;
3. files/views/sheets/revisions affected;
4. whether undo is available;
5. whether the action affects only local state or shared/remote state;
6. whether a recoverable copy is retained.

## Button rule

The destructive button repeats the outcome.

Good:

> Delete Level 2  
> 18 walls, 6 rooms, and 2 views depend on this level and will also be deleted. This can be undone.  
> **Delete Level 2**

Bad:

> Are you sure?  
> **Confirm**

## Unknown dependency count

Never invent a count to make the dialog look complete.

Use:

> Arq could not calculate all dependencies. Review Model health before deleting this level.

If the product cannot determine consequences safely, block the operation if required by the underlying product contract.

## Archive versus delete

Use **Archive project** when the project remains recoverable through the archive workflow.

Use **Delete project** only for actual deletion semantics.

Use **Permanently delete** only when the product actually has no supported recovery path after the action.

## Replace/overwrite

Name both sides:

- Replace local working copy with remote revision
- Replace existing export file
- Restore snapshot and discard 4 local operations

Do not say only **Replace** when the target is ambiguous.
