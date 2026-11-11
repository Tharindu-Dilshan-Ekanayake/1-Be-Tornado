import { MAX_EQUIPPED_PETS } from '@shared/balance'
import { nextTornado, upgradePrice } from '@shared/logic'

import { useGame } from '../../store/game'

/** Whether anything in the Store's tornadoes, upgrades or pets is waiting for you. */
export function useStoreAlert() {
  const petAlert = useGame((s) => s.profile.equippedPets.length < Math.min(MAX_EQUIPPED_PETS, s.profile.pets.length))
  const typeAlert = useGame((s) => {
    const next = nextTornado(s.profile)
    return Boolean(next && s.profile.wins >= next.cost)
  })
  const upgradeAlert = useGame((s) =>
    ['size', 'speed', 'surge'].some((id) => {
      const price = upgradePrice(s.profile, id)
      return price !== null && s.profile.wins >= price
    }),
  )
  return { typeAlert, upgradeAlert, petAlert, any: typeAlert || upgradeAlert || petAlert }
}
