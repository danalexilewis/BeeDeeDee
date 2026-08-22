/**
 * Loads the application stylesheet into the test browser.
 *
 * Without it every Tailwind utility is inert, elements collapse to zero size, and
 * visibility or layout assertions fail for reasons that have nothing to do with
 * the component under test.
 */
import '../index.css';
