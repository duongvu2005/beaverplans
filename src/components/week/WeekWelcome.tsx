import type { DayOfWeek } from '@/core/types';
import type { StepName, Welcome } from '@/core/welcome';
import { WEEK } from '@/core/types';
import { dayName } from '@/i18n/dateCopy';
import { useCopy, useLocale } from '@/i18n/localeContext';
import check from '@/components/shared/checkbox.module.css';
import { TickIcon } from '@/components/shared/icons/TickIcon';
import styles from './WeekWelcome.module.css';

/** The days the picture lights up, once the guide is ON the days step; before that the strip is empty. */
const DEMO_DAYS: ReadonlySet<DayOfWeek> = new Set<DayOfWeek>(['mon', 'wed', 'fri']);

/** The three weights, easy to hard — the levels WeightDots offers. */
const LEVELS = [1, 2, 3] as const;

/** Level to catalog key, as WeightDots does it: the words live in the catalog. */
const WEIGHT_KEY = { 1: 'easy', 2: 'medium', 3: 'hard' } as const;

const ORDER: ReadonlyArray<StepName> = ['project', 'task', 'days'];

/**
 * How much of the guide to draw: `full` (the wide board's, every step at once),
 * `explainer` (single column, before Get started) or `guided` (single column,
 * after Get started; the guide points at the board's real controls).
 */
export type WelcomeMode = 'full' | 'explainer' | 'guided';

type WeekWelcomeProps = {
    welcome: Welcome;
    /** Whether this week is being guided at all: the whole guide when it is, one quiet line when it is not. */
    guiding: boolean;
    mode: WelcomeMode;
    /** do the step that is current: add a project, add a task, open the editor */
    onAdvance: () => void;
    /** leave the explainer and start guiding — `explainer` mode only */
    onStart: () => void;
    /** Turn the guide off for good. Offered by both modes with a button bar, not by `guided`. */
    onSkip: () => void;
};

/** What the week pane shows while nothing is scheduled in it: the empty state and the guide at once. */
export function WeekWelcome({
    welcome,
    guiding,
    mode,
    onAdvance,
    onStart,
    onSkip,
}: WeekWelcomeProps) {
    const { locale } = useLocale();
    const { common, weekWelcome } = useCopy();
    const step = welcome.step;

    if (!guiding) {
        return (
            <div className={styles.quiet}>
                <span className={styles.quietTitle}>{weekWelcome.quietTitle}</span>
                {weekWelcome.quietBody}
            </div>
        );
    }

    const title =
        welcome.step === 'project'
            ? weekWelcome.titleProject
            : welcome.step === 'task'
              ? weekWelcome.titleTask(welcome.projectName)
              : weekWelcome.titleDays;
    const sub =
        step === 'project'
            ? weekWelcome.subProject
            : step === 'task'
              ? weekWelcome.subTask
              : weekWelcome.subDays;
    const cta =
        step === 'project'
            ? weekWelcome.ctaProject
            : step === 'task'
              ? weekWelcome.ctaTask
              : weekWelcome.ctaDays;

    const bodies: Record<StepName, string> = {
        project: weekWelcome.stepProjectBody,
        task: weekWelcome.stepTaskBody,
        days: weekWelcome.stepDaysBody,
    };
    const headings: Record<StepName, string> = {
        project: weekWelcome.stepProject,
        task: weekWelcome.stepTask,
        days: weekWelcome.stepDays,
    };

    // -1 in the explainer, where nothing is current yet: every step then draws
    // 'ahead', which is the truth about a board nobody has touched.
    const current = mode === 'explainer' ? -1 : ORDER.indexOf(step);

    return (
        <div className={styles.welcome} data-mode={mode}>
            <div className={styles.lede}>
                <p className={styles.title}>
                    {mode === 'explainer' ? weekWelcome.titleProject : title}
                </p>
                <p className={styles.sub}>{mode === 'explainer' ? weekWelcome.subProject : sub}</p>
            </div>

            <ol className={styles.steps} aria-label={weekWelcome.stepsLabel}>
                {ORDER.map((name, i) => {
                    const state = i < current ? 'done' : i === current ? 'current' : 'ahead';
                    // Body and sample travel together. The wide board renders
                    // all three and lets the stylesheet choose how many show.
                    const detail = mode === 'full' || state === 'current';
                    return (
                        <li
                            key={name}
                            className={styles.step}
                            data-state={state}
                            aria-current={state === 'current' ? 'step' : undefined}
                        >
                            {state === 'done' ? (
                                <span
                                    className={styles.num}
                                    role="img"
                                    aria-label={weekWelcome.stepDone}
                                >
                                    <TickIcon />
                                </span>
                            ) : (
                                <span className={styles.num} aria-hidden="true">
                                    {i + 1}
                                </span>
                            )}
                            <span className={styles.body}>
                                <span className={styles.h}>{headings[name]}</span>
                                {detail && <span className={styles.d}>{bodies[name]}</span>}
                                {detail && name === 'project' && (
                                    <span className={styles.demo} aria-hidden="true">
                                        <span className={styles.projectSample}>
                                            {weekWelcome.stepProjectSample}
                                        </span>
                                    </span>
                                )}
                                {detail && name === 'task' && (
                                    <span className={styles.demo} aria-hidden="true">
                                        <span className={check.box} />
                                        <span className={styles.sample}>
                                            {weekWelcome.stepTaskSample}
                                        </span>
                                    </span>
                                )}
                                {detail && name === 'days' && (
                                    <span className={styles.daysDemo} aria-hidden="true">
                                        <span className={styles.days} data-picked={step === 'days'}>
                                            {WEEK.map((day) => (
                                                <span
                                                    key={day}
                                                    className={
                                                        step === 'days' && DEMO_DAYS.has(day)
                                                            ? `${styles.day} ${styles.dayOn}`
                                                            : styles.day
                                                    }
                                                >
                                                    {dayName(day, locale, 'letter')}
                                                </span>
                                            ))}
                                        </span>
                                        <span className={styles.legend}>
                                            {LEVELS.map((weight) => (
                                                <span key={weight} className={styles.level}>
                                                    <span className={styles.pips}>
                                                        {LEVELS.map((level) => (
                                                            <span
                                                                key={level}
                                                                className={
                                                                    level <= weight
                                                                        ? `${styles.pip} ${styles.on}`
                                                                        : styles.pip
                                                                }
                                                            />
                                                        ))}
                                                    </span>
                                                    {common.weights[WEIGHT_KEY[weight]]}
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ol>

            {/* `guided` gets no bar: it points at the board's real controls. */}
            {mode === 'full' && (
                <div className={styles.actions}>
                    <button type="button" className={styles.cta} onClick={onAdvance}>
                        {cta}
                    </button>
                    <button type="button" className={styles.skip} onClick={onSkip}>
                        {weekWelcome.skip}
                    </button>
                </div>
            )}
            {mode === 'explainer' && (
                <>
                    <button type="button" className={styles.cta} onClick={onStart}>
                        {weekWelcome.getStarted}
                    </button>
                    {/* Stacked and boxless, unlike the wide board's pair. */}
                    <button type="button" className={styles.skipQuiet} onClick={onSkip}>
                        {weekWelcome.skip}
                    </button>
                </>
            )}
        </div>
    );
}
