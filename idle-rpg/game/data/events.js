const Helper = require('../../utils/Helper');
const enumHelper = require('../../utils/enumHelper');
const messages = require('../data/messages');
const Database = require('../../database/Database');
const { pvpLevelRestriction } = require('../../../settings');

const events = {
  battle: {
    pvpPreperation: (selectedPlayer, mappedPlayers, onlinePlayers) => {
      return new Promise((resolve) => {
        if (selectedPlayer.equipment.weapon.name !== enumHelper.equipment.empty.weapon.name) {
          const sameMapPlayers = mappedPlayers.filter(player => player.name !== selectedPlayer.name
            && onlinePlayers.findIndex(onlinePlayer => (onlinePlayer.discordId === player.discordId)) !== -1
            && player.level <= selectedPlayer.level + pvpLevelRestriction && player.level >= selectedPlayer.level - pvpLevelRestriction);

          if (sameMapPlayers.length > 0 && selectedPlayer.health > (100 + (selectedPlayer.level * 5)) / 4) {
            const randomPlayerIndex = Helper.randomBetween(0, sameMapPlayers.length - 1);
            const randomPlayer = sameMapPlayers[randomPlayerIndex];

            if (selectedPlayer.equipment.weapon.name !== enumHelper.equipment.empty.weapon.name && randomPlayer.equipment.weapon.name !== enumHelper.equipment.empty.weapon.name) {
              return resolve({ randomPlayer });
            }
          }
        }

        return resolve({});
      });
    },

    pvpResults: (discordHook, { attacker, defender, attackerDamage, defenderDamage }) => {
      return new Promise((resolve) => {
        let selectedPlayer = attacker;
        let randomPlayer = defender;
        const randomPlayerMaxHealth = 100 + (randomPlayer.level * 5);
        const playerMaxHealth = 100 + (selectedPlayer.level * 5);

        const battleResult = `Battle Results:
          ${Helper.generatePlayerName(selectedPlayer, true)}'s \`${selectedPlayer.equipment.weapon.name}\` did ${attackerDamage} damage.
          ${Helper.generatePlayerName(selectedPlayer, true)} has ${selectedPlayer.health} HP left.
          ${Helper.generatePlayerName(randomPlayer, true)} 's \`${randomPlayer.equipment.weapon.name}\` did ${defenderDamage} damage.
          ${Helper.generatePlayerName(randomPlayer, true)} has ${randomPlayer.health} HP left.`;

        Helper.printEventDebug(battleResult);

        if (selectedPlayer.health <= 0) {
          const eventMsg = `[\`${selectedPlayer.map.name}\`] ${Helper.generatePlayerName(randomPlayer, true)} just killed ${Helper.generatePlayerName(selectedPlayer, true)} with ${Helper.generateGenderString(randomPlayer, 'his')} \`${randomPlayer.equipment.weapon.name}\`!
  ${Helper.generatePlayerName(selectedPlayer, true)} dealt \`${attackerDamage}\` dmg, received \`${defenderDamage}\` dmg! [${Helper.generatePlayerName(randomPlayer, true)} HP:${defender.health}/${randomPlayerMaxHealth}]`;

          const expGain = Math.floor(attackerDamage / 8);
          const eventLog = `Died to ${defender.name} in ${selectedPlayer.map.name}.`;
          const otherPlayerLog = `Killed ${selectedPlayer.name} in ${selectedPlayer.map.name}. [${expGain} exp]`;

          selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastEvents');
          selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastPvpEvents');
          randomPlayer = Helper.logEvent(randomPlayer, otherPlayerLog, 'pastEvents');
          randomPlayer = Helper.logEvent(randomPlayer, otherPlayerLog, 'pastPvpEvents');
          selectedPlayer.battles.lost++;
          randomPlayer.battles.won++;
          randomPlayer.experience.current += expGain;
          randomPlayer.experience.total += expGain;

          return Promise.all([
            Helper.sendMessage(discordHook, 'twitch', selectedPlayer, false, eventMsg),
            Helper.sendPrivateMessage(discordHook, selectedPlayer, eventLog, true),
            Helper.sendPrivateMessage(discordHook, randomPlayer, otherPlayerLog, true),
            Database.savePlayer(randomPlayer)
          ])
            .then(resolve({
              result: enumHelper.battle.outcomes.lost,
              updatedAttacker: selectedPlayer,
              updatedDefender: randomPlayer
            }));
        }

        if (defender.health > 0 && selectedPlayer.health > 0) {
          const eventMsg = attackerDamage > defenderDamage
            ? `[\`${selectedPlayer.map.name}\`] ${Helper.generatePlayerName(selectedPlayer, true)} attacked ${Helper.generatePlayerName(randomPlayer, true)} with ${Helper.generateGenderString(selectedPlayer, 'his')} ${selectedPlayer.equipment.weapon.name} but ${Helper.generateGenderString(randomPlayer, 'he')} managed to get away!
  ${Helper.capitalizeFirstLetter(Helper.generateGenderString(selectedPlayer, 'he'))} dealt \`${attackerDamage}\` dmg, received \`${defenderDamage}\` dmg! [HP:${selectedPlayer.health}/${playerMaxHealth}]-[${Helper.generatePlayerName(randomPlayer, true)} HP:${defender.health}/${randomPlayerMaxHealth}]`
            : `[\`${selectedPlayer.map.name}\`] ${Helper.generatePlayerName(selectedPlayer, true)} attacked ${Helper.generatePlayerName(randomPlayer, true)} with ${Helper.generateGenderString(selectedPlayer, 'his')} ${selectedPlayer.equipment.weapon.name} but ${Helper.generatePlayerName(randomPlayer, true)} was too strong!
  ${Helper.capitalizeFirstLetter(Helper.generateGenderString(selectedPlayer, 'he'))} dealt \`${attackerDamage}\` dmg, received \`${defenderDamage}\` dmg! [HP:${selectedPlayer.health}/${playerMaxHealth}]-[${Helper.generatePlayerName(randomPlayer, true)} HP:${defender.health}/${randomPlayerMaxHealth}]`;

          const expGainAttacker = Math.floor(defenderDamage / 8);
          const expGainDefender = Math.floor(attackerDamage / 8);
          const eventLog = `Attacked ${randomPlayer.name} in ${selectedPlayer.map.name} with ${selectedPlayer.equipment.weapon.name} and dealt ${attackerDamage} damage! [${expGainAttacker} exp]`;
          const otherPlayerLog = `Attacked by ${selectedPlayer.name} in ${selectedPlayer.map.name} with ${selectedPlayer.equipment.weapon.name} and received ${attackerDamage} damage! [${expGainDefender} exp]`;

          selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastEvents');
          selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastPvpEvents');
          randomPlayer = Helper.logEvent(randomPlayer, otherPlayerLog, 'pastEvents');
          randomPlayer = Helper.logEvent(randomPlayer, otherPlayerLog, 'pastPvpEvents');
          selectedPlayer.experience.current += expGainAttacker;
          selectedPlayer.experience.total += expGainAttacker;
          randomPlayer.experience.current += expGainDefender;
          randomPlayer.experience.total += expGainDefender;

          return Promise.all([
            Helper.sendMessage(discordHook, 'twitch', selectedPlayer, false, eventMsg),
            Helper.sendPrivateMessage(discordHook, selectedPlayer, eventLog, true),
            Helper.sendPrivateMessage(discordHook, randomPlayer, otherPlayerLog, true),
            Database.savePlayer(randomPlayer)
          ])
            .then(resolve({
              result: enumHelper.battle.outcomes.fled,
              updatedAttacker: selectedPlayer,
              updatedDefender: randomPlayer
            }));
        }

        const expGain = Math.floor(defenderDamage / 8);
        const eventMsg = `[\`${selectedPlayer.map.name}\`] ${Helper.generatePlayerName(selectedPlayer, true)} just killed \`${randomPlayer.name}\` with ${Helper.generateGenderString(selectedPlayer, 'his')} \`${selectedPlayer.equipment.weapon.name}\`!
  ${Helper.capitalizeFirstLetter(Helper.generateGenderString(selectedPlayer, 'he'))} dealt \`${attackerDamage}\` dmg, received \`${defenderDamage}\` dmg! [HP:${selectedPlayer.health}/${playerMaxHealth}]-[${Helper.generatePlayerName(randomPlayer, true)} HP:${defender.health}/${randomPlayerMaxHealth}]`;
        const eventLog = `Killed ${randomPlayer.name} in ${selectedPlayer.map.name}. [${expGain} exp]`;
        const otherPlayerLog = `Died to ${selectedPlayer.name} in ${selectedPlayer.map.name}.`;

        selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastEvents');
        selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastPvpEvents');
        randomPlayer = Helper.logEvent(randomPlayer, otherPlayerLog, 'pastEvents');
        randomPlayer = Helper.logEvent(randomPlayer, otherPlayerLog, 'pastPvpEvents');
        selectedPlayer.battles.won++;
        randomPlayer.battles.lost++;
        selectedPlayer.experience.current += expGain;
        selectedPlayer.experience.total += expGain;

        return Promise.all([
          Helper.sendMessage(discordHook, 'twitch', selectedPlayer, false, eventMsg),
          Helper.sendPrivateMessage(discordHook, selectedPlayer, eventLog, true),
          Helper.sendPrivateMessage(discordHook, randomPlayer, otherPlayerLog, true),
          Database.savePlayer(randomPlayer)
        ])
          .then(resolve({
            result: enumHelper.battle.outcomes.win,
            updatedAttacker: selectedPlayer,
            updatedDefender: randomPlayer
          }));
      });
    },

    pveResults: (discordHook, MapClass, results, multiplier) => {
      return new Promise((resolve) => {
        const mobMaxHealth = results.defender.maxHealth;
        const playerMaxHealth = 100 + (results.attacker.level * 5);

        let selectedPlayer = results.attacker;
        const battleResult = `Battle Results:
          ${Helper.generatePlayerName(selectedPlayer, true)}'s \`${selectedPlayer.equipment.weapon.name}\` did ${results.attackerDamage} damage.
          ${Helper.generatePlayerName(selectedPlayer, true)} has ${selectedPlayer.health} / ${playerMaxHealth} HP left.
          ${results.defender.name}'s \`${results.defender.equipment.weapon.name}\` did ${results.defenderDamage} damage.
          ${results.defender.name} has ${results.defender.health} / ${mobMaxHealth} HP left.`;

        Helper.printEventDebug(battleResult);

        if (selectedPlayer.health <= 0) {
          const eventMsg = `[\`${selectedPlayer.map.name}\`] \`${results.defender.name}\`'s \`${results.defender.equipment.weapon.name}\` just killed ${Helper.generatePlayerName(selectedPlayer, true)}!
  ${Helper.capitalizeFirstLetter(Helper.generateGenderString(selectedPlayer, 'he'))} dealt \`${results.attackerDamage}\` dmg, received \`${results.defenderDamage}\` dmg! [\`${results.defender.name}\` HP:${results.defender.health}/${mobMaxHealth}]`;

          const eventLog = `${results.defender.name}'s ${results.defender.equipment.weapon.name} just killed you in ${selectedPlayer.map.name}!`;
          selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastEvents');
          selectedPlayer.battles.lost++;

          return Promise.all([
            Helper.sendMessage(discordHook, 'twitch', selectedPlayer, false, eventMsg),
            Helper.sendPrivateMessage(discordHook, selectedPlayer, eventLog, true)
          ])
            .then(resolve({
              result: enumHelper.battle.outcomes.lost,
              updatedPlayer: selectedPlayer,
              updatedMob: results.defender
            }));
        }

        if (results.defender.health > 0 && selectedPlayer.health > 0) {
          const expGain = Math.floor(((results.defender.experience * multiplier) + (results.defenderDamage / 4)) / 6);
          let eventMsg = results.attackerDamage > results.defenderDamage
            ? `[\`${selectedPlayer.map.name}\`] \`${results.defender.name}\` just fled from ${Helper.generatePlayerName(selectedPlayer, true)}!
  ${Helper.capitalizeFirstLetter(Helper.generateGenderString(selectedPlayer, 'he'))} dealt \`${results.attackerDamage}\` dmg, received \`${results.defenderDamage}\` dmg and gained \`${expGain}\` exp! [HP:${selectedPlayer.health}/${playerMaxHealth}]-[\`${results.defender.name}\` HP:${results.defender.health}/${mobMaxHealth}]`
            : `[\`${selectedPlayer.map.name}\`] ${Helper.generatePlayerName(selectedPlayer, true)} just fled from \`${results.defender.name}\`!
  ${Helper.capitalizeFirstLetter(Helper.generateGenderString(selectedPlayer, 'he'))} dealt \`${results.attackerDamage}\` dmg, received \`${results.defenderDamage}\` dmg and gained \`${expGain}\` exp! [HP:${selectedPlayer.health}/${playerMaxHealth}]-[\`${results.defender.name}\` HP:${results.defender.health}/${mobMaxHealth}]`;

          let eventLog = results.attackerDamage > results.defenderDamage
            ? `${results.defender.name} fled from you in ${selectedPlayer.map.name}! [${expGain} exp]`
            : `You fled from ${results.defender.name} in ${selectedPlayer.map.name}! [${expGain} exp]`;

          if (expGain === 0) {
            eventMsg = eventMsg.replace(` and gained \`${expGain}\` exp`, '');
            eventLog = eventlog.replace(` [${expGain} exp]`, '');
          }

          selectedPlayer.experience.current += expGain;
          selectedPlayer.experience.total += expGain;
          selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastEvents');

          return Promise.all([
            Helper.sendMessage(discordHook, 'twitch', selectedPlayer, false, eventMsg),
            Helper.sendPrivateMessage(discordHook, selectedPlayer, eventLog, true)
          ])
            .then(resolve({
              result: enumHelper.battle.outcomes.fled,
              updatedPlayer: selectedPlayer,
              updatedMob: results.defender
            }));
        }
        const goldGain = Number(results.defender.gold * multiplier);
        const expGain = Math.floor((results.defender.experience * multiplier) + (results.defenderDamage / 4));

        let eventMsg = `[\`${selectedPlayer.map.name}\`] ${Helper.generatePlayerName(selectedPlayer, true)}'s \`${selectedPlayer.equipment.weapon.name}\` just killed \`${results.defender.name}\`!
  ${Helper.capitalizeFirstLetter(Helper.generateGenderString(selectedPlayer, 'he'))} dealt \`${results.attackerDamage}\` dmg, received \`${results.defenderDamage}\` dmg and gained \`${expGain}\` exp and \`${goldGain}\` gold! [HP:${selectedPlayer.health}/${playerMaxHealth}]-[\`${results.defender.name}\` HP:${results.defender.health}/${mobMaxHealth}]`;
        let eventLog = `Killed ${results.defender.name} with your ${selectedPlayer.equipment.weapon.name} in ${selectedPlayer.map.name}. [${expGain} exp/${goldGain} gold]`;

        if (goldGain === 0) {
          eventMsg = eventMsg.replace(` and \`${goldGain}\` gold`, '');
          eventLog = eventLog.replace(`/${goldGain} gold`, '');
        }

        selectedPlayer.experience.current += expGain;
        selectedPlayer.experience.total += expGain;
        selectedPlayer.gold.current += goldGain;
        selectedPlayer.gold.total += goldGain;
        selectedPlayer.kills.mob++;
        selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastEvents');
        selectedPlayer.battles.won++;

        return Promise.all([
          Helper.sendMessage(discordHook, 'twitch', selectedPlayer, false, eventMsg),
          Helper.sendPrivateMessage(discordHook, selectedPlayer, eventLog, true)
        ])
          .then(resolve({
            result: enumHelper.battle.outcomes.win,
            updatedPlayer: selectedPlayer,
            updatedMob: results.defender
          }));
      });
    }
  },

  messages: {
    randomCampEventMessage: (selectedPlayer) => {
      const randomEventInt = Helper.randomBetween(0, messages.event.camp.length - 1);
      let { eventMsg, eventLog } = messages.event.camp[randomEventInt];
      // TODO: clean up this mess
      const updatedMessages = Helper.generateMessageWithNames(eventMsg, eventLog, selectedPlayer);
      eventMsg = updatedMessages.eventMsg;
      eventLog = updatedMessages.eventLog;

      return { eventMsg, eventLog };
    },

    randomItemEventMessage: (selectedPlayer, item) => {
      const randomEventInt = Helper.randomBetween(0, messages.event.item.length - 1);
      let { eventMsg, eventLog } = messages.event.item[randomEventInt];
      // TODO: clean up this mess
      const updatedMessages = Helper.generateMessageWithNames(eventMsg, eventLog, selectedPlayer, item);
      eventMsg = updatedMessages.eventMsg;
      eventLog = updatedMessages.eventLog;

      return { eventMsg, eventLog };
    },

    randomGambleEventMessage: (selectedPlayer, luckGambleGold, isWin) => {
      if (isWin) {
        const randomEventInt = Helper.randomBetween(0, messages.event.gamble.win.length - 1);
        let { eventMsg, eventLog } = messages.event.gamble.win[randomEventInt];
        // TODO: clean up this mess
        const updatedMessages = Helper.generateMessageWithNames(eventMsg, eventLog, selectedPlayer, undefined, luckGambleGold);
        eventMsg = updatedMessages.eventMsg;
        eventLog = updatedMessages.eventLog;

        return { eventMsg, eventLog };
      }

      const randomEventInt = Helper.randomBetween(0, messages.event.gamble.lose.length - 1);
      let { eventMsg, eventLog } = messages.event.gamble.lose[randomEventInt];
      // TODO: clean up this mess
      const updatedMessages = Helper.generateMessageWithNames(eventMsg, eventLog, selectedPlayer, undefined, luckGambleGold);
      eventMsg = updatedMessages.eventMsg;
      eventLog = updatedMessages.eventLog;

      return { eventMsg, eventLog };
    }
  },

  utils: {
    dropItem: (InventoryManager, selectedPlayer, item) => {
      if (item.position !== enumHelper.inventory.position) {
        const oldItemRating = Helper.calculateItemRating(selectedPlayer, selectedPlayer.equipment[item.position]);
        const newItemRating = Helper.calculateItemRating(selectedPlayer, item);
        if (oldItemRating > newItemRating) {
          selectedPlayer = InventoryManager.addEquipmentIntoInventory(selectedPlayer, item);
        } else {
          selectedPlayer = Helper.setPlayerEquipment(selectedPlayer, enumHelper.equipment.types[item.position].position, item);
        }
      } else {
        selectedPlayer = InventoryManager.addItemIntoInventory(selectedPlayer, item);
      }
    },

    townItem: (InventoryManager, discordHook, selectedPlayer, item, itemCost) => {
      let purchasedItem = false;
      if (item.position !== enumHelper.inventory.position) {
        const oldItemRating = Helper.calculateItemRating(selectedPlayer, selectedPlayer.equipment[item.position]);
        const newItemRating = Helper.calculateItemRating(selectedPlayer, item);
        if (oldItemRating < newItemRating) {
          purchasedItem = true;
          selectedPlayer.gold.current -= itemCost;
          selectedPlayer = Helper.setPlayerEquipment(selectedPlayer, enumHelper.equipment.types[item.position].position, item);
        }
      } else if (selectedPlayer.inventory.items.length < enumHelper.inventory.maxItemAmount) {
        purchasedItem = true;
        selectedPlayer.gold.current -= itemCost;
        selectedPlayer = InventoryManager.addItemIntoInventory(selectedPlayer, item);
      }

      if (purchasedItem) {
        const eventMsg = `[\`${selectedPlayer.map.name}\`] ${Helper.generatePlayerName(selectedPlayer, true)} just purchased \`${item.name}\` for ${itemCost} gold!`;
        const eventLog = `Purchased ${item.name} from Town for ${itemCost} Gold`;

        Helper.sendMessage(discordHook, 'twitch', selectedPlayer, false, eventMsg)
          .then(() => Helper.sendPrivateMessage(discordHook, selectedPlayer, eventLog, true));
        selectedPlayer = Helper.logEvent(selectedPlayer, eventLog, 'pastEvents');
      }
    },

    stealEquip: (InventoryManager, discordHook, stealingPlayer, victimPlayer, itemKey) => {
      let stolenEquip;
      if (victimPlayer.equipment[itemKey].previousOwners.length > 0) {
        const lastOwnerInList = victimPlayer.equipment[itemKey].previousOwners[victimPlayer.equipment[itemKey].previousOwners.length - 1];
        const removePreviousOwnerName = victimPlayer.equipment[itemKey].name.replace(`${lastOwnerInList}`, `${victimPlayer.name}`);
        stolenEquip = victimPlayer.equipment[itemKey];
        stolenEquip.name = removePreviousOwnerName;

        const eventMsg = Helper.setImportantMessage(`${stealingPlayer.name} just stole ${stolenEquip.name}!`);
        const eventLog = `Stole ${victimPlayer.equipment[itemKey].name}`;
        const otherPlayerLog = `${stealingPlayer.name} stole ${victimPlayer.equipment[itemKey].name} from you`;

        Helper.sendMessage(discordHook, 'twitch', stealingPlayer, false, eventMsg)
          .then(() => Helper.sendPrivateMessage(discordHook, stealingPlayer, eventLog, true))
          .then(() => Helper.sendPrivateMessage(discordHook, victimPlayer, otherPlayerLog, true));
        stealingPlayer = Helper.logEvent(stealingPlayer, eventLog, 'pastEvents');
        stealingPlayer = Helper.logEvent(stealingPlayer, eventLog, 'pastPvpEvents');
        victimPlayer = Helper.logEvent(victimPlayer, otherPlayerLog, 'pastEvents');
        victimPlayer = Helper.logEvent(victimPlayer, otherPlayerLog, 'pastPvpEvents');
      } else {
        stolenEquip = victimPlayer.equipment[itemKey];
        stolenEquip.name = `${victimPlayer.name}'s ${victimPlayer.equipment[itemKey].name}`;
        const eventMsg = Helper.setImportantMessage(`${stealingPlayer.name} just stole ${stolenEquip.name}!`);
        const eventLog = `Stole ${stolenEquip.name}`;
        const otherPlayerLog = `${stealingPlayer.name} stole ${victimPlayer.equipment[itemKey].name} from you`;

        Helper.sendMessage(discordHook, 'twitch', stealingPlayer, false, eventMsg)
          .then(() => Helper.sendPrivateMessage(discordHook, stealingPlayer, eventLog, true))
          .then(() => Helper.sendPrivateMessage(discordHook, victimPlayer, otherPlayerLog, true));
        stealingPlayer = Helper.logEvent(stealingPlayer, eventLog, 'pastEvents');
        stealingPlayer = Helper.logEvent(stealingPlayer, eventLog, 'pastPvpEvents');
        victimPlayer = Helper.logEvent(victimPlayer, otherPlayerLog, 'pastEvents');
        victimPlayer = Helper.logEvent(victimPlayer, otherPlayerLog, 'pastPvpEvents');
      }
      victimPlayer.stolen++;
      stealingPlayer.stole++;
      if (victimPlayer.equipment[itemKey].name !== enumHelper.equipment.empty[itemKey].name) {
        stealingPlayer.equipment[itemKey].position = itemKey;
        victimPlayer.equipment[itemKey].position = itemKey;
        const oldItemRating = Helper.calculateItemRating(stealingPlayer, stealingPlayer.equipment[itemKey]);
        const newItemRating = Helper.calculateItemRating(victimPlayer, victimPlayer.equipment[itemKey]);
        if (oldItemRating < newItemRating) {
          stealingPlayer = Helper.setPlayerEquipment(stealingPlayer, enumHelper.equipment.types[itemKey].position, stolenEquip);
          if (victimPlayer.equipment[itemKey].previousOwners.length > 0) {
            stealingPlayer.equipment[itemKey].previousOwners = victimPlayer.equipment[itemKey].previousOwners;
            stealingPlayer.equipment[itemKey].previousOwners.push(victimPlayer.name);
          } else {
            stealingPlayer.equipment[itemKey].previousOwners = [`${victimPlayer.name}`];
          }
        } else {
          stealingPlayer = InventoryManager.addEquipmentIntoInventory(stealingPlayer, stolenEquip);
        }
        if (victimPlayer.inventory.equipment.length > 0 && victimPlayer.inventory.equipment.find(equip => equip.position === enumHelper.equipment.types[itemKey].position) !== undefined) {
          const equipFromInventory = victimPlayer.inventory.equipment.filter(equipment => equipment.position === enumHelper.equipment.types[itemKey].position)
            .sort((item1, item2) => {
              return item1.power - item2.power;
            })[0];
          victimPlayer = Helper.setPlayerEquipment(victimPlayer, enumHelper.equipment.types[itemKey].position, equipFromInventory);
        } else {
          victimPlayer = Helper.setPlayerEquipment(victimPlayer, enumHelper.equipment.types[itemKey].position, enumHelper.equipment.empty[itemKey]);
        }
      }
    }
  }
}

module.exports = events;