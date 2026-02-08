import type { PetAction } from './pet-mood-service';
import type { WorkspaceVibe, VibeLevel } from './workspace-vibe-service';
import { vibeLevel } from './workspace-vibe-service';

// ─── Types ────────────────────────────────────────────────────────────────

export type Personality = 'supportive' | 'sarcastic' | 'stoic';

export type RobotReaction = {
	mood: PetAction;
	message: string;
	/** How long the reaction should last (seconds). 0 = no forced duration */
	durationSeconds: number;
	/** Animation temperature 0–1. Controls intensity of movements. */
	temperature: number;
	/** Optional scene props to place */
	sceneAction?: { type: 'place'; propType: string; autoInteract: boolean } | { type: 'clear' };
};

// ─── Message Banks ────────────────────────────────────────────────────────

const SUPPORTIVE_MESSAGES: Record<VibeLevel, string[]> = {
	zen: [
		"You're in the zone! Keep going, you awesome human.",
		"Clean code, clean mind. Beautiful.",
		"Zero errors? You're basically a wizard right now.",
		"Smooth sailing. I'm proud of you!",
		"This is giving 'main character who codes perfectly' energy.",
		"Look at you, flowing like water through this codebase."
	],
	focused: [
		"Nice focus! You've got this.",
		"Steady progress. Every line counts!",
		"You're building something great, one commit at a time.",
		"I see you working hard. Don't forget to hydrate!",
		"That concentration is impressive. Keep it up!",
		"Your code is looking good. Trust the process."
	],
	busy: [
		"Things are getting lively! Take a breath when you can.",
		"A few bumps in the road, but nothing you can't handle.",
		"Hey, errors happen to the best of us. You'll squash them.",
		"Remember: even senior devs Google things. You're doing great.",
		"The bugs are temporary. Your skills are permanent.",
		"One step at a time. You're closer than you think."
	],
	stressed: [
		"Hey, I see those errors piling up. Want to take a quick stretch?",
		"Deep breath. You've solved harder problems than this before.",
		"It's okay to step away for a minute. The code will wait.",
		"Maybe save your work and grab some water? Self-care is real.",
		"You've been at it a while. Remember: breaks make you faster.",
		"These errors don't define you. You'll get through this!",
		"Even the best codebases have bad days. Hang in there."
	],
	overwhelmed: [
		"Stop. Breathe. You're going to be okay.",
		"This is A LOT. But you've survived 100% of your bad coding days so far.",
		"Please take a break. Seriously. The merge conflicts can wait 5 minutes.",
		"I believe in you, even when the compiler doesn't.",
		"Remember why you started. You love this. The bugs are just plot twists.",
		"Have you tried turning your stress off and on again? (Please rest.)",
		"You are more than your error count. Always."
	]
};

const SARCASTIC_MESSAGES: Record<VibeLevel, string[]> = {
	zen: [
		"Zero errors? Did you even write any code today?",
		"Suspiciously clean... what are you hiding?",
		"Look at Mr./Ms. Perfect over here. Show off.",
		"I'm almost bored watching you succeed. Almost.",
		"No errors? That's a bug in itself."
	],
	focused: [
		"Oh, you're actually being productive. Novel concept.",
		"Keep it up and I might have to promote you to Senior Human.",
		"Not bad. Not great. But definitely not bad.",
		"Wow, you're writing code that works. Alert the media."
	],
	busy: [
		"A few errors? Those are rookie numbers. Or are they?",
		"Ah, the classic 'let me change 15 files at once' strategy.",
		"Your file-switching speed is giving me whiplash.",
		"I see you're going for the 'fix one, create two' approach."
	],
	stressed: [
		"So... this is fine, right? Everything is fine.",
		"Your error count is giving me secondhand anxiety.",
		"Have you considered that maybe the code is gaslighting you?",
		"Bold strategy: creating errors faster than you fix them.",
		"The code giveth, and the code taketh away. Mostly taketh."
	],
	overwhelmed: [
		"I would help, but I'm just a robot who watches you suffer.",
		"On the bright side... uh... give me a minute.",
		"git reset --hard HEAD. Just a thought. Not advice.",
		"Maybe this is the universe telling you to learn Rust instead.",
		"At least your chair is comfortable? Probably?"
	]
};

const STOIC_MESSAGES: Record<VibeLevel, string[]> = {
	zen: [
		"System nominal.",
		"No issues detected.",
		"Workspace status: clear.",
		"All signals normal."
	],
	focused: [
		"Minor activity. Status: productive.",
		"Moderate complexity detected. Proceeding.",
		"Workspace health: good."
	],
	busy: [
		"Elevated activity. Monitor recommended.",
		"Multiple signals active. Stay aware.",
		"Error count rising. Acknowledged."
	],
	stressed: [
		"Stress indicators elevated. Consider a pause.",
		"High error density detected. Review recommended.",
		"Multiple issues detected. Systematic approach advised."
	],
	overwhelmed: [
		"Critical stress threshold reached. Break recommended.",
		"System overload indicators. Stand down advised.",
		"Too many concurrent issues. Prioritization required."
	]
};

const MESSAGE_BANKS: Record<Personality, Record<VibeLevel, string[]>> = {
	supportive: SUPPORTIVE_MESSAGES,
	sarcastic: SARCASTIC_MESSAGES,
	stoic: STOIC_MESSAGES
};

// ─── Mood mapping ─────────────────────────────────────────────────────────

/**
 * Map vibe level to animation temperature.
 * zen = calm/slow, overwhelmed = hyper/frantic.
 */
function vibeTemperature(level: VibeLevel): number {
	switch (level) {
		case 'zen': return 0.2;
		case 'focused': return 0.4;
		case 'busy': return 0.6;
		case 'stressed': return 0.8;
		case 'overwhelmed': return 1.0;
	}
}

function pickMood(vibe: WorkspaceVibe): PetAction {
	const level = vibeLevel(vibe.stressScore);

	// Special conditions first
	if (vibe.gitState === 'conflicted') {return 'error';}
	if (vibe.deletionSpike && vibe.stressScore > 50) {return 'knocked';}

	switch (level) {
		case 'zen':
			return pickRandom(['idle', 'success', 'dance'] as PetAction[]);
		case 'focused':
			return pickRandom(['coding', 'thinking'] as PetAction[]);
		case 'busy':
			return pickRandom(['reviewing', 'debugging'] as PetAction[]);
		case 'stressed':
			return pickRandom(['debugging', 'error', 'thinking'] as PetAction[]);
		case 'overwhelmed':
			return pickRandom(['error', 'knocked', 'shrug'] as PetAction[]);
	}
}

function pickDuration(level: VibeLevel): number {
	switch (level) {
		case 'zen': return 4;
		case 'focused': return 3;
		case 'busy': return 3;
		case 'stressed': return 5;
		case 'overwhelmed': return 6;
	}
}

// ─── Scene suggestions ────────────────────────────────────────────────────

function suggestScene(vibe: WorkspaceVibe): RobotReaction['sceneAction'] | undefined {
	// Only suggest scenes occasionally for dramatic effect
	if (Math.random() > 0.25) {return undefined;}

	const level = vibeLevel(vibe.stressScore);
	if (level === 'zen' && Math.random() < 0.5) {
		return { type: 'place', propType: 'trophy', autoInteract: false };
	}
	if (level === 'overwhelmed' && Math.random() < 0.4) {
		return { type: 'place', propType: 'coffee_mug', autoInteract: false };
	}
	if (vibe.errorCount > 5 && Math.random() < 0.3) {
		return { type: 'place', propType: 'wrench', autoInteract: true };
	}
	return undefined;
}

// ─── Public API ───────────────────────────────────────────────────────────

export class MoodInterpreter {
	private personality: Personality = 'supportive';
	private lastMood: PetAction = 'idle';
	private lastVibeLevel: VibeLevel = 'zen';
	private consecutiveSameLevel = 0;

	public setPersonality(p: Personality) {
		this.personality = p;
	}

	/**
	 * Interpret a workspace vibe into a robot reaction.
	 * Uses smart heuristics to avoid repetitive reactions.
	 */
	public interpret(vibe: WorkspaceVibe): RobotReaction | null {
		const level = vibeLevel(vibe.stressScore);

		// Avoid spamming the same level reactions
		if (level === this.lastVibeLevel) {
			this.consecutiveSameLevel++;
			// Only react every 5th vibe at the same level (unless overwhelmed)
			if (this.consecutiveSameLevel % 5 !== 0 && level !== 'overwhelmed') {
				return null;
			}
		} else {
			this.consecutiveSameLevel = 0;
		}

		this.lastVibeLevel = level;

		const mood = pickMood(vibe);
		const bank = MESSAGE_BANKS[this.personality][level];
		const message = pickRandom(bank);
		const duration = pickDuration(level);
		const temperature = vibeTemperature(level);
		const sceneAction = suggestScene(vibe);

		// Avoid sending the same mood twice in a row
		if (mood === this.lastMood && !sceneAction) {
			return null;
		}

		this.lastMood = mood;

		return {
			mood,
			message,
			durationSeconds: duration,
			temperature,
			sceneAction
		};
	}

	/**
	 * Generate a "welcome back" reaction when the user regains focus.
	 */
	public welcomeBack(vibe: WorkspaceVibe): RobotReaction {
		const level = vibeLevel(vibe.stressScore);
		const messages: Record<Personality, string[]> = {
			supportive: [
				"Welcome back! I missed you.",
				"Hey, you're back! Ready to crush it?",
				"Glad to see you again! Let's do this.",
				"Welcome back! I kept your chair warm."
			],
			sarcastic: [
				"Oh, you're back. How generous.",
				"Took you long enough. The bugs were getting lonely.",
				"Welcome back to the chaos you left behind.",
				"You left, but the errors sure didn't."
			],
			stoic: [
				"Focus restored.",
				"Session resumed.",
				"Welcome back. Status update available."
			]
		};

		return {
			mood: level === 'overwhelmed' ? 'error' : level === 'stressed' ? 'thinking' : 'wave',
			message: pickRandom(messages[this.personality]),
			durationSeconds: 2,
			temperature: vibeTemperature(level)
		};
	}

	/**
	 * Generate a milestone celebration.
	 */
	public celebrate(reason: string): RobotReaction {
		const messages: Record<Personality, string[]> = {
			supportive: [
				`Woohoo! ${reason} Celebrate the wins!`,
				`Amazing! ${reason} You earned this!`,
				`YES! ${reason} Keep that momentum!`
			],
			sarcastic: [
				`Oh wow, ${reason.toLowerCase()} Someone alert the Nobel committee.`,
				`${reason} Don't let it go to your head.`,
				`${reason} I guess even a broken clock is right twice a day.`
			],
			stoic: [
				`Achievement noted: ${reason}`,
				`${reason} Proceeding.`,
				`Milestone reached. ${reason}`
			]
		};

		return {
			mood: 'success',
			message: pickRandom(messages[this.personality]),
			durationSeconds: 4,
			temperature: 0.85,
			sceneAction: Math.random() < 0.5
				? { type: 'place', propType: 'star', autoInteract: false }
				: undefined
		};
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}
