import { Request, Response } from 'express';
import { createIamRole, createSecurityGroup, createSpotFleet, deleteSecurityGroup, deleteIamRole, cancelSpotFleetRequest } from './aws';
import { storeFleetInfo, deleteFleetInfo, FleetInfo, getFleetInfoFromMongo } from './mongo';

export async function handleCreateSpotFleetRequest(request: Request, response: Response) {
    try {
        const { roleArn, roleName } = await createIamRole();
        const { securityGroupId, groupName } = await createSecurityGroup();
        const spotFleetRequestId = await createSpotFleet(roleArn, securityGroupId);

        const fleetInfo: FleetInfo = {
            primaryUniqueId: new Date().toISOString(),
            roleName,
            securityGroupId,
            spotFleetRequestId
        };

        const insertedId = await storeFleetInfo(fleetInfo);

        response.status(201).json({
            message: 'Spot Fleet Request Created',
            data: { ...fleetInfo, insertedId }
        });
    } catch (err) {
        console.error('Error creating Spot Fleet request:', err);
        response.status(500).json({ message: 'Error creating Spot Fleet request', error: err.message });
    }
}

export async function handleDeleteSpotFleet(request: Request<{ spotFleetId: string }>, response: Response) {
    const { spotFleetId } = request.params;

    try {
        const fleetInfo = await getFleetInfoFromMongo(spotFleetId);

        if (!fleetInfo) {
            throw new Error('Fleet info not found in database');
        }

        const { roleName, securityGroupId } = fleetInfo;

        await cancelSpotFleetRequest(spotFleetId)
        await deleteSecurityGroup(securityGroupId);
        await deleteIamRole(roleName);
        await deleteFleetInfo(spotFleetId);

        response.status(200).json({ message: 'Spot Fleet Request Cancelled and resources deleted', spotFleetId });
    } catch (err) {
        console.error('Error cancelling Spot Fleet request:', err);
        response.status(500).json({ message: 'Error cancelling Spot Fleet request', error: err.message });
    }
}
