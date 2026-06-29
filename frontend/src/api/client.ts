import axios from 'axios'
import type { Project } from '../model/types'

// Klient backendu (FastAPI). W Fazie 1 służy głównie do round-tripa modelu:
// wysyłamy Project i sprawdzamy, czy lustro Pydantic go przyjmuje.
export const api = axios.create({ baseURL: '/api', timeout: 8000 })

export interface ValidateResult {
  ok: boolean
  name: string
  panels: number
  rooms: number
  materials: number
}

export async function validateProject(project: Project): Promise<ValidateResult> {
  const { data } = await api.post<ValidateResult>('/project/validate', { project })
  return data
}
