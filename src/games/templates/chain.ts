import { ICommandDefinition } from "../../command-parser";
import { Player } from "../../room-activity";
import { Game } from "../../room-game";
import { IAbility, IItem, IMove, IPokemon } from "../../types/in-game-data-types";

export type Link = IPokemon | IMove | IItem | IAbility;

export abstract class Chain extends Game {
	acceptsFormes: boolean = false;
	canReverseLinks: boolean = false;
	currentPlayer: Player | null = null;
	keys: string[] = [];
	letterBased: boolean = true;
	linkEndCounts: Dict<number> = {};
	linkEnds: Dict<number> = {};
	linkLength: number = 1;
	linkStartCounts: Dict<number> = {};
	linkStarts: Dict<number> = {};
	linksType: string = 'Pokemon';
	maxPlayers: number = 20;
	playerList: Player[] = [];
	points = new Map<Player, number>();
	pool: Dict<Link> = {};
	roundLinks: Dict<boolean> = {};
	roundTime: number = 7 * 1000;
	survivalRound: number = 0;
	targetLinkEnds: string[] = [];
	targetLinkStarts: string[] = [];

	// always defined once the game starts
	currentLink!: Link;

	getLinkStarts(link: Link): string[] {
		const start = link.id.substr(0, this.linkLength);
		if (!isNaN(parseInt(start))) return [];
		return [start];
	}

	getLinkEnds(link: Link): string[] {
		const end = link.id.substr(-1, this.linkLength);
		if (!isNaN(parseInt(end))) return [];
		return [end];
	}

	onSignups() {
		if (this.options.freejoin) this.timeout = setTimeout(() => this.start(), 5000);
	}

	onInitialize() {
		const pool: Dict<Link> = {};
		const keys = [];
		if (this.variant) {
			if (this.variant === 'moves') {
				for (const i in Dex.data.moves) {
					const move = Dex.getExistingMove(i);
					if (move.isNonstandard) continue;
					if (this.letterBased) {
						if (move.id === 'hiddenpower') continue;
						if (!this.getLinkStarts(move).length || !this.getLinkEnds(move).length) continue;
					}
					pool[i] = move;
					keys.push(i);
				}
				this.linksType = 'move';
			} else if (this.variant === 'items') {
				for (const i in Dex.data.items) {
					const item = Dex.getExistingItem(i);
					if (item.isNonstandard === true) continue;
					if (this.letterBased && (!this.getLinkStarts(item).length || !this.getLinkEnds(item).length)) continue;
					pool[i] = item;
					keys.push(i);
				}
				this.linksType = 'item';
			} else if (this.variant === 'abilities') {
				for (const i in Dex.data.abilities) {
					const ability = Dex.getExistingAbility(i);
					if (ability.isNonstandard) continue;
					if (this.letterBased && (!this.getLinkStarts(ability).length || !this.getLinkEnds(ability).length)) continue;
					pool[i] = ability;
					keys.push(i);
				}
				this.linksType = 'ability';
			} else {
				throw new Error("Game variation'" + this.variant + "' has no pool");
			}
		} else {
			for (const i in Dex.data.pokedex) {
				const pokemon = Dex.getExistingPokemon(i);
				if ((pokemon.forme && !this.acceptsFormes) || pokemon.isNonstandard) continue;
				if (this.letterBased && (!this.getLinkStarts(pokemon).length || !this.getLinkEnds(pokemon).length)) continue;
				pool[i] = pokemon;
				keys.push(i);
			}
		}
		this.pool = pool;
		this.keys = keys;

		const linkStartsByName: Dict<string[]> = {};
		const linkEndsByName: Dict<string[]> = {};
		for (const i in pool) {
			const starts = this.getLinkStarts(pool[i]);
			for (let j = 0; j < starts.length; j++) {
				if (!linkStartsByName[starts[j]]) linkStartsByName[starts[j]] = [];
				if (!linkStartsByName[starts[j]].includes(pool[i].id)) linkStartsByName[starts[j]].push(pool[i].id);
			}
			if (this.canReverseLinks) {
				const ends = this.getLinkEnds(pool[i]);
				for (let j = 0; j < ends.length; j++) {
					if (!linkEndsByName[ends[j]]) linkEndsByName[ends[j]] = [];
					if (!linkEndsByName[ends[j]].includes(pool[i].id)) linkEndsByName[ends[j]].push(pool[i].id);
				}
			}
		}

		for (const i in linkStartsByName) {
			this.linkStarts[i] = linkStartsByName[i].length;
		}

		for (const i in linkEndsByName) {
			this.linkEnds[i] = linkEndsByName[i].length;
		}
	}

	onStart() {
		this.nextRound();
	}

	filterUnusableLinkStarts(links: string[]): string[] {
		const filtered: string[] = [];
		for (let i = 0; i < links.length; i++) {
			if (!this.linkStarts[links[i]] || this.linkStartCounts[links[i]] === this.linkStarts[links[i]]) continue;
			filtered.push(links[i]);
		}
		return filtered;
	}

	filterUnusableLinkEnds(links: string[]): string[] {
		const filtered: string[] = [];
		for (let i = 0; i < links.length; i++) {
			if (!this.linkEnds[links[i]] || this.linkEndCounts[links[i]] === this.linkEnds[links[i]]) continue;
			filtered.push(links[i]);
		}
		return filtered;
	}

	resetLinkCounts() {
		this.roundLinks = {};
		this.linkStartCounts = {};
		this.linkEndCounts = {};
	}

	setLink(input?: string) {
		let id = Tools.toId(input) || this.sampleOne(this.keys);
		let link = this.pool[id];
		let linkStarts = this.getLinkStarts(link);
		let linkEnds = this.getLinkEnds(link);
		this.markLinkUsed(linkStarts, linkEnds);
		let nextLinkStarts = this.filterUnusableLinkStarts(linkEnds);
		let nextLinkEnds: string[] = [];
		if (this.canReverseLinks) nextLinkEnds = this.filterUnusableLinkEnds(linkStarts);
		let linkToSkip: Link | null = null;
		while (this.currentLink === link || (!nextLinkStarts.length && !nextLinkEnds.length) || (linkToSkip && this.currentLink === linkToSkip)) {
			if (input && this.playerList.length) {
				const list = Tools.joinList(nextLinkStarts.concat(nextLinkEnds).map(x => x.toUpperCase()));
				this.say("There are no " + (list ? "'" + list + "' " + this.linksType + " links left" : "links with " + link.name) + "! Substituting in a random " + this.linksType + ".");
				input = '';
				if (!linkToSkip) linkToSkip = this.pool[id];
			}
			this.resetLinkCounts();
			id = this.sampleOne(this.keys);
			link = this.pool[id];
			linkStarts = this.getLinkStarts(link);
			linkEnds = this.getLinkEnds(link);
			this.markLinkUsed(linkStarts, linkEnds);
			nextLinkStarts = this.filterUnusableLinkStarts(linkEnds);
			if (this.canReverseLinks) nextLinkEnds = this.filterUnusableLinkEnds(linkStarts);
		}
		this.currentLink = link;
		this.targetLinkStarts = nextLinkStarts;
		this.targetLinkEnds = nextLinkEnds;
		this.roundLinks[this.currentLink.id] = true;
	}

	onNextRound() {
		let text;
		if (this.options.freejoin) {
			this.resetLinkCounts();
			this.setLink();
			text = "The " + this.mascot!.species + " spelled out **" + this.currentLink.name + "**.";
			this.on(text, () => {
				this.timeout = setTimeout(() => {
					this.say("Time's up!");
					this.nextRound();
				}, this.roundTime);
			});
		} else {
			if (this.currentPlayer) {
				this.players[this.currentPlayer.id].eliminated = true;
				this.currentPlayer = null;
			}
			if (!this.playerList.length) {
				if (this.getRemainingPlayerCount() < 2 || this.survivalRound >= 20) {
					this.end();
					return;
				}
				this.survivalRound++;
				this.playerList = this.shufflePlayers();
				if (this.survivalRound > 1 && this.roundTime > 3000) this.roundTime -= 500;
				this.resetLinkCounts();
				this.setLink();
				const html = this.getRoundHtml(this.getPlayerNames, null, "Round " + this.survivalRound);
				const uhtmlName = this.uhtmlBaseName + '-round-html';
				this.onUhtml(uhtmlName, html, () => {
					this.timeout = setTimeout(() => this.nextRound(), 5 * 1000);
				});
				this.sayUhtml(uhtmlName, html);
				return;
			}

			let currentPlayer = this.playerList.shift();
			while (currentPlayer && currentPlayer.eliminated) {
				currentPlayer = this.playerList.shift();
			}
			if (!currentPlayer || currentPlayer.eliminated) {
				this.onNextRound();
				return;
			}

			text = currentPlayer.name + " you're up! The " + this.mascot!.species + " spelled out **" + this.currentLink.name + "**.";
			this.on(text, () => {
				this.currentPlayer = currentPlayer!;
				this.timeout = setTimeout(() => {
					this.say("Time's up!");
					this.currentPlayer!.eliminated = true;
					this.currentPlayer = null;
					this.nextRound();
				}, this.roundTime);
			});
		}
		this.say(text);
	}

	onEnd() {
		if (this.options.freejoin) return;
		const len = this.getRemainingPlayerCount();
		if (len) {
			const names = this.getPlayerNames();
			this.say("**Winner" + (len > 1 ? "s" : "") + "**: " + names);
			let earnings = 500;
			if (earnings > 1000) earnings = 1000;
			for (const i in this.players) {
				const player = this.players[i];
				if (player.eliminated) continue;
				this.winners.set(player, 1);
				this.addBits(player, earnings);
			}
		} else {
			this.say("No winners this game!");
		}
	}

	markLinkUsed(linkStarts: string[], linkEnds: string[]) {
		for (let i = 0; i < linkStarts.length; i++) {
			if (!this.linkStarts[linkStarts[i]]) continue;
			if (!this.linkStartCounts[linkStarts[i]]) this.linkStartCounts[linkStarts[i]] = 0;
			this.linkStartCounts[linkStarts[i]]++;
		}
		for (let i = 0; i < linkEnds.length; i++) {
			if (!this.linkEnds[linkEnds[i]]) continue;
			if (!this.linkEndCounts[linkEnds[i]]) this.linkEndCounts[linkEnds[i]] = 0;
			this.linkEndCounts[linkEnds[i]]++;
		}
	}
}

export let commands: Dict<ICommandDefinition<Chain>> = {
	guess: {
		command(target, room, user) {
			if (!this.started || (this.players[user.id] && this.players[user.id].eliminated)) return;
			if (!this.options.freejoin && (!this.currentPlayer || this.players[user.id] !== this.currentPlayer)) return;
			if (!this.targetLinkStarts.length && !this.targetLinkEnds.length) return;
			const guess = Tools.toId(target);
			if (this.roundLinks[guess]) return;
			const possibleLink: Link | undefined = this.pool[guess];
			if (!possibleLink) {
				if (this.options.freejoin) return;
				return this.say("'" + guess + "' is not a valid " + this.linksType + ".");
			}
			const linkStarts = this.getLinkStarts(possibleLink);
			let linkEnds: string[] = [];
			if (this.canReverseLinks) linkEnds = this.getLinkEnds(possibleLink);
			let match = false;
			for (let i = 0; i < linkStarts.length; i++) {
				if (this.targetLinkStarts.includes(linkStarts[i])) {
					match = true;
					break;
				}
			}
			if (!match && this.canReverseLinks) {
				for (let i = 0; i < linkEnds.length; i++) {
					if (this.targetLinkEnds.includes(linkEnds[i])) {
						match = true;
						break;
					}
				}
			}
			if (!match) return;
			if (this.timeout) clearTimeout(this.timeout);
			if (this.options.freejoin) {
				this.targetLinkStarts = [];
				this.targetLinkEnds = [];
				const player = this.createPlayer(user) || this.players[user.id];
				let points = this.points.get(player) || 0;
				points++;
				this.points.set(player, points);
				if (points === this.options.points) {
					this.say('**' + player.name + '** wins' + (this.parentGame ? '' : ' the game') + '! A possible answer was __' + possibleLink.name + '__.');
					this.winners.set(player, 1);
					this.convertPointsToBits(50);
					this.end();
					return;
				}
				this.say('**' + player.name + '** advances to **' + points + '** point' + (points > 1 ? 's' : '') + '! A possible answer was __' + possibleLink.name + '__.');
				this.timeout = setTimeout(() => this.nextRound(), 5000);
			} else {
				this.currentPlayer = null;
				this.setLink(guess);
				this.nextRound();
			}
		},
		aliases: ['g'],
	},
};

export let disabled = false;
