import { createContext, useContext, useEffect, useState, type ReactNode, type ReactElement } from 'react'

export type ActiveGame = 'deadlock' | 'dota2'

type GameContextValue = {
  activeGame: ActiveGame
  toggleGame: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

const STORAGE_KEY = 'umbrella_active_game'

export function GameProvider({ children }: { children: ReactNode }): ReactElement {
  const [activeGame, setActiveGame] = useState<ActiveGame>(() =>
    localStorage.getItem(STORAGE_KEY) === 'dota2' ? 'dota2' : 'deadlock'
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeGame)
  }, [activeGame])

  function toggleGame(): void {
    setActiveGame((g) => (g === 'deadlock' ? 'dota2' : 'deadlock'))
  }

  return <GameContext.Provider value={{ activeGame, toggleGame }}>{children}</GameContext.Provider>
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
