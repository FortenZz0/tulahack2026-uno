
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/planets") {
            return Response.json({
                updatedAt: null,
                planets: []
            });
        }

        return new Response("Not Found", {
            status: 404
        });
    },

    async scheduled(event, env, ctx) {
        console.log("обновить");
    }
};
