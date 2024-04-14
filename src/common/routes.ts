import { Request, Response, Router } from "express";
import { handleCreateSpotFleetRequest, handleDeleteSpotFleet, handleRunPlaywrightTests } from "./handlers";

const router = Router();

router.post('/createSpotFleet', async (request: Request, response: Response) => {
    await handleCreateSpotFleetRequest(request, response);
})

router.post('/runPlaywright', async (req: Request, res: Response) => {
    await handleRunPlaywrightTests(req, res);
});

router.delete('/deleteSpotFleet/:spotFleetId', async (req: Request<{ spotFleetId: string }>, res: Response) => {
    await handleDeleteSpotFleet(req, res);
});

export default router;