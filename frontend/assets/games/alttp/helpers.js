import { GameHelpers } from '../../helpers/index.js';
import stateManager from '../../stateManagerSingleton.js';

export class ALTTPHelpers extends GameHelpers {
  has_sword() {
    return (
      stateManager.inventory.has('Fighter Sword') ||
      stateManager.inventory.has('Master Sword') ||
      stateManager.inventory.has('Tempered Sword') ||
      stateManager.inventory.has('Golden Sword')
    );
  }

  has_beam_sword() {
    return (
      stateManager.inventory.has('Master Sword') ||
      stateManager.inventory.has('Tempered Sword') ||
      stateManager.inventory.has('Golden Sword')
    );
  }

  has_melee_weapon() {
    return this.has_sword() || stateManager.inventory.has('Hammer');
  }

  can_lift_rocks() {
    if (!stateManager.inventory) {
      console.error('Inventory is undefined in can_lift_rocks!', {
        helperInstance: this,
        stackTrace: new Error().stack,
      });
      return false;
    }

    const result =
      stateManager.inventory.has('Power Glove') ||
      stateManager.inventory.has('Titans Mitts');
    console.log('can_lift_rocks check:', {
      helperThis: this,
      inventory: stateManager.inventory,
      hasPowerGlove: stateManager.inventory.has('Power Glove'),
      hasTitansMitts: stateManager.inventory.has('Titans Mitts'),
      result,
    });

    return result;
  }

  can_use_bombs(count = 1) {
    console.log('Starting can_use_bombs() evaluation');

    const bombless = stateManager.state.hasFlag('bombless_start');
    console.log(`bombless_start flag: ${bombless}`);

    let bombs = bombless ? 0 : 10;
    console.log(`Base bombs after bombless check: ${bombs}`);

    const plus5Count = stateManager.inventory.count('Bomb Upgrade (+5)');
    const plus10Count = stateManager.inventory.count('Bomb Upgrade (+10)');
    const plus50Count = stateManager.inventory.count('Bomb Upgrade (50)');

    console.log(`Upgrade counts:
            +5: ${plus5Count}
            +10: ${plus10Count}
            +50: ${plus50Count}`);

    bombs += plus5Count * 5;
    bombs += plus10Count * 10;
    bombs += plus50Count * 50;

    console.log(`Bombs after basic upgrades: ${bombs}`);

    if (plus5Count > 6) {
      const bonusBombs = (plus5Count - 6) * 10;
      bombs += bonusBombs;
      console.log(
        `Added ${bonusBombs} bonus bombs from ${
          plus5Count - 6
        } extra +5 upgrades`
      );
    }

    const finalResult = bombs >= Math.min(count, 50);
    console.log(
      `Final result: ${finalResult} (have ${bombs} bombs, need ${count})`
    );

    return finalResult;
  }

  can_kill_most_things(count = 5) {
    return (
      this.has_melee_weapon() ||
      stateManager.inventory.has('Cane of Somaria') ||
      (stateManager.inventory.has('Cane of Byrna') &&
        (count < 6 || this.can_extend_magic())) ||
      this.can_shoot_arrows() ||
      stateManager.inventory.has('Fire Rod') ||
      this.can_use_bombs(count * 4)
    );
  }

  can_bomb_or_bonk() {
    return stateManager.inventory.has('Pegasus Boots') || this.can_use_bombs();
  }

  can_lift_heavy_rocks() {
    const result = stateManager.inventory.has('Titans Mitts');
    console.log('can_lift_heavy_rocks check:', {
      hasTitansMitts: stateManager.inventory.has('Titans Mitts'),
      result,
    });

    return result;
  }

  has_fire_source() {
    return (
      stateManager.inventory.has('Fire Rod') ||
      stateManager.inventory.has('Lamp')
    );
  }

  can_shoot_arrows() {
    const hasBow =
      stateManager.inventory.has('Bow') ||
      stateManager.inventory.has('Silver Bow');

    console.log('State check in can_shoot_arrows:', {
      stateExists: !!stateManager.state,
      hasHasFlagMethod:
        stateManager.state && typeof stateManager.state.hasFlag === 'function',
      retroBowFlag: stateManager.state?.hasFlag('retro_bow'),
    });

    if (stateManager.state.hasFlag('retro_bow')) {
      return hasBow && stateManager.inventory.has('Single Arrow');
    }
    return hasBow;
  }

  can_retrieve_tablet() {
    const hasBookOfMudora = stateManager.inventory.has('Book of Mudora');

    if (!hasBookOfMudora) {
      return false;
    }

    // Check if we have beam sword OR (swordless mode AND hammer)
    const hasSword = this.has_beam_sword();
    const isSwordlessMode = stateManager.state.hasFlag('swordless');
    const hasHammer = stateManager.inventory.has('Hammer');

    return hasSword || (isSwordlessMode && hasHammer);
  }
}
