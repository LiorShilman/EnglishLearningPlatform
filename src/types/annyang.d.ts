declare module 'annyang' {
    const annyang: {
        start: (options?: { autoRestart?: boolean; continuous?: boolean }) => void;
        abort: () => void;
        pause: () => void;
        resume: () => void;
        setLanguage: (language: string) => void;
        addCallback: (event: string, callback: Function) => void;
        removeCallback: (event: string, callback?: Function) => void;
    };
    export default annyang;
}