/**
 * Pozycjonowanie płyt względem wnętrza pokoju.
 *
 * Układ pokojowy (od wewnętrznych twarzy ścian):
 *   x — od lewej ściany (world X min)
 *   y — od podłogi (world Z min)
 *   z — od przedniej ściany (world Y max); z=0 gdy płyta przy przedniej ścianie
 *
 * Wszystkie wartości ≥ 0 gdy płyta mieści się w pokoju.
 */
import type { Panel, Room, Vec3 } from './types'
import { panelWorldAABB, type AABB3 } from './obb'
import { roomWorldAABB } from './collisions'

export interface RoomCoords {
  x: number
  y: number
  z: number
}

export function worldToRoomCoords(panel: Panel, room: Room): RoomCoords {
  const roomBB = roomWorldAABB(room)
  if (!roomBB) return { x: 0, y: 0, z: 0 }
  const pb: AABB3 = panelWorldAABB(panel)
  return {
    x: pb.min[0] - roomBB.min[0],
    y: pb.min[2] - roomBB.min[2],
    z: roomBB.max[1] - pb.max[1],   // od przedniej ściany (world Y max side)
  }
}

/** Zwraca nową pozycję świata dla płyty tak, by jej world-AABB trafiło na `coords`. */
export function roomCoordsToWorld(coords: RoomCoords, panel: Panel, room: Room): Vec3 {
  const roomBB = roomWorldAABB(room)
  if (!roomBB) return panel.transform.position
  const pb: AABB3 = panelWorldAABB(panel)
  const dx = roomBB.min[0] + coords.x - pb.min[0]
  const dy = (roomBB.max[1] - coords.z) - pb.max[1]  // world Y ← roomZ (odwrócony)
  const dz = roomBB.min[2] + coords.y - pb.min[2]    // world Z ← roomY
  return [
    panel.transform.position[0] + dx,
    panel.transform.position[1] + dy,
    panel.transform.position[2] + dz,
  ]
}
