import { create } from 'zustand'

/**
 * Stan WYŁĄCZNIE widoku sceny — celowo ODDZIELNY od projectStore, więc NIE jest
 * zapisywany (brak autosave/serializacji). Model Room i eksport JSON zostają
 * pełne; to tylko jak scenę pokazujemy teraz.
 */
interface ViewState {
  roomsVisible: boolean
  wallOpacity: number // 0..1 (1 = pełne krycie; <1 = półprzezroczyste ściany)
  magnetEnabled: boolean // snapping płyt przy przeciąganiu gizmem
  showLabels: boolean // etykiety front/back + numery krawędzi na zaznaczonej płycie
  activeView: '3d' | 'cutlist' // aktywny widok (view-only, NIE do JSON/autosave)
  showCollisions: boolean // kolizje OBB w scenie 3D (view-only, NIE do JSON/autosave)
  showCabinetWizard: boolean // modal kreatora szafki (view-only)
  showHingeModels: boolean // modele 3D zawiasów (DAE) w scenie (view-only)
  showHingeDrills: boolean // markery nawiertów zawiasowych w scenie (view-only)
  toggleRooms: () => void
  setWallOpacity: (v: number) => void
  toggleMagnet: () => void
  toggleLabels: () => void
  setActiveView: (v: '3d' | 'cutlist') => void
  toggleCollisions: () => void
  setShowCabinetWizard: (v: boolean) => void
  toggleHingeModels: () => void
  toggleHingeDrills: () => void
}

export const useViewStore = create<ViewState>((set) => ({
  roomsVisible: true,
  wallOpacity: 1,
  magnetEnabled: true,
  showLabels: false,
  activeView: '3d',
  showCollisions: true,
  showCabinetWizard: false,
  showHingeModels: true,
  showHingeDrills: true,
  toggleRooms: () => set((s) => ({ roomsVisible: !s.roomsVisible })),
  setWallOpacity: (wallOpacity) => set({ wallOpacity }),
  toggleMagnet: () => set((s) => ({ magnetEnabled: !s.magnetEnabled })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  setActiveView: (activeView) => set({ activeView }),
  toggleCollisions: () => set((s) => ({ showCollisions: !s.showCollisions })),
  setShowCabinetWizard: (showCabinetWizard) => set({ showCabinetWizard }),
  toggleHingeModels: () => set((s) => ({ showHingeModels: !s.showHingeModels })),
  toggleHingeDrills: () => set((s) => ({ showHingeDrills: !s.showHingeDrills })),
}))
