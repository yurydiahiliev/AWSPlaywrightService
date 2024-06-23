import { Request, Response, Router } from "express";
import { handleCreateSpotFleetRequest, handleDeleteSpotFleet } from "./handlers";

const router = Router();

router.post('/createSpotFleet', async (request: Request, response: Response) => {
    await handleCreateSpotFleetRequest(request, response);
})

router.delete('/deleteSpotFleet/:spotFleetId', async (req: Request<{ spotFleetId: string }>, res: Response) => {
    await handleDeleteSpotFleet(req, res);
});

export default router;