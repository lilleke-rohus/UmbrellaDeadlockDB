import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'

export type ActiveGame = 'deadlock' | 'dota2'

type GameContextValue = {
  activeGame: ActiveGame
  toggleGame: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

const STORAGE_KEY = 'umbrella_active_game'

function getStoredActiveGame(): ActiveGame {
  return localStorage.getItem(STORAGE_KEY) === 'dota2' ? 'dota2' : 'deadlock'
}

function getNextGame(game: ActiveGame): ActiveGame {
  return game === 'deadlock' ? 'dota2' : 'deadlock'
}

export function GameProvider({ children }: { children: ReactNode }): ReactElement {
  const [activeGame, setActiveGame] = useState<ActiveGame>(getStoredActiveGame)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeGame)
  }, [activeGame])

  const toggleGame = useCallback((): void => {
    setActiveGame(getNextGame)
  }, [])

  const value = useMemo<GameContextValue>(() => ({ activeGame, toggleGame }), [activeGame, toggleGame])

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
