class Queue {
    constructor() {
        this.queue = Promise.resolve();
    }

    push(fn){
        const job = this.queue.then(fn);
        this.queue = job.catch(() => {});
        return job;
    }
}

const queue = new Queue();

module.exports = queue;
