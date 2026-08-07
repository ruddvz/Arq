import { describe, expect, it } from 'vitest';
import { roomTint } from './room-tint';

describe('roomTint', () => {
  it('reads the golden fixture the way an architect would', () => {
    // Every one of these is a real room name from the Courtyard House fixture.
    expect(roomTint('Living')).toBe('room-living');
    expect(roomTint('Family lounge')).toBe('room-living');
    expect(roomTint('Kitchen')).toBe('room-cooking');
    expect(roomTint('Dining')).toBe('room-dining');
    expect(roomTint('Guest bedroom')).toBe('room-sleeping');
    expect(roomTint('Open courtyard')).toBe('room-outdoor');
    expect(roomTint('Powder room')).toBe('room-wet');
    expect(roomTint('Guest ensuite')).toBe('room-wet');
    expect(roomTint('Utility')).toBe('room-service');
    expect(roomTint('Linen')).toBe('room-service');
    expect(roomTint('Pantry')).toBe('room-service');
    expect(roomTint('Inner hall')).toBe('room-circulation');
    expect(roomTint('Entry foyer')).toBe('room-circulation');
    expect(roomTint('Daylit stair')).toBe('room-circulation');
    expect(roomTint('North gallery')).toBe('room-circulation');
  });

  it('lets the more specific word win, because order is the whole rule', () => {
    // A guest ensuite is a wet room, not a bedroom - the bathroom pattern has
    // to be tested before the sleeping one or the tint is simply wrong.
    expect(roomTint('Guest ensuite')).toBe('room-wet');
    expect(roomTint('Bedroom ensuite')).toBe('room-wet');
    // And a bedroom that mentions nothing wetter stays a bedroom.
    expect(roomTint('Principal bedroom')).toBe('room-sleeping');
  });

  it('matches whole words, so a room is not classified by a fragment', () => {
    // "Bedford" contains "bed"; a room named after a place is not a bedroom.
    expect(roomTint('Bedford room')).toBe('room-neutral');
    expect(roomTint('Hallmark suite')).toBe('room-neutral');
  });

  it('is not case-sensitive, because a name is free text', () => {
    expect(roomTint('KITCHEN')).toBe('room-cooking');
    expect(roomTint('kitchen')).toBe('room-cooking');
  });

  it('falls to neutral rather than guessing at a name it does not know', () => {
    // The correct failure: an unrecognised room is drawn as a room, not as a
    // guess about what happens inside it.
    expect(roomTint('Zone 4')).toBe('room-neutral');
    expect(roomTint('Cuisine')).toBe('room-neutral');
    expect(roomTint('')).toBe('room-neutral');
  });
});
