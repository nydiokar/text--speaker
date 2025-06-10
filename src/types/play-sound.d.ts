declare module 'play-sound' {
    interface PlaySound {
        play(file: string, callback?: (err: any) => void): any;
        (opts: any): PlaySound;
    }
    const ps: PlaySound;
    export = ps;
} 