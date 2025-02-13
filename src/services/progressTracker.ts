export class ProgressTracker {
    private segments: any[];
    private startTime: number;
    private pauseTime: number | null = null;
    private totalPauseTime: number = 0;

    constructor(segments: any[]) {
        this.segments = segments;
        this.startTime = Date.now();
    }

    pause() {
        if (!this.pauseTime) {
            this.pauseTime = Date.now();
        }
    }

    resume() {
        if (this.pauseTime) {
            this.totalPauseTime += Date.now() - this.pauseTime;
            this.pauseTime = null;
        }
    }

    renderProgressBar(currentIndex: number = 0): string {
        const progress = Math.round((currentIndex / this.segments.length) * 40);
        const bar = '='.repeat(progress) + '-'.repeat(40 - progress);
        const percent = Math.round((currentIndex / this.segments.length) * 100);
        
        const statusText = this.formatStatus(currentIndex, this.segments.length);
        return `\r[${bar}] ${statusText}`;
    }

    private formatStatus(current: number, total: number): string {
        const percent = Math.round((current / total) * 100);
        if (current === total) return `${percent}%`;
        return `${percent}% (${current}/${total})`;
    }
}
