// declare process.env with the framework var
declare namespace NodeJS {
    interface ProcessEnv {
        FRAMEWORK: "react" | "svelte";
    }
}

declare module "*.module.css" {
    const classes: {[key: string]: string};
    export default classes;
}