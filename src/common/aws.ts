import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

AWS.config.update({ region: 'us-east-1' });

const ec2 = new AWS.EC2();
const iam = new AWS.IAM();

const keyPairName = 'test.pem';
const vpcId = 'vpc-05322bf757c9b2f06';
const instanceType = 't2.micro';
const availabilityZone = 'us-east-1a';
const amiId = 'ami-b70554c8';

async function createIamRole() {
    const roleName = `spot-fleet-role-${uuidv4()}`;
    const assumeRolePolicyDocument = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Principal: { Service: 'spotfleet.amazonaws.com' },
                Action: 'sts:AssumeRole'
            }
        ]
    });

    const roleParams: AWS.IAM.CreateRoleRequest = {
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument,
        Description: 'Role for Spot Fleet'
    };

    const roleData = await iam.createRole(roleParams).promise();

    const policyParams: AWS.IAM.AttachRolePolicyRequest = {
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetRole'
    };

    await iam.attachRolePolicy(policyParams).promise();

    return { roleArn: roleData.Role.Arn, roleName };
}

async function createSecurityGroup() {
    const groupName = `spot-fleet-sg-${uuidv4()}`;
    const groupDescription = 'Security group for Spot Fleet';

    const sgParams: AWS.EC2.CreateSecurityGroupRequest = {
        Description: groupDescription,
        GroupName: groupName,
        VpcId: vpcId
    };

    const sgData = await ec2.createSecurityGroup(sgParams).promise();

    const ipPermissions: AWS.EC2.IpPermission[] = [
        {
            IpProtocol: '-1', // -1 means all protocols
            FromPort: -1,     // -1 means all ports
            ToPort: -1,       // -1 means all ports
            IpRanges: [{ CidrIp: '0.0.0.0/0' }] // Allows all IPs
        }
    ];

    const authorizeParams: AWS.EC2.AuthorizeSecurityGroupIngressRequest = {
        GroupId: sgData.GroupId,
        IpPermissions: ipPermissions
    };

    await ec2.authorizeSecurityGroupIngress(authorizeParams).promise();

    return { securityGroupId: sgData.GroupId!, groupName };
}

async function createSpotFleet(roleArn: string, securityGroupId: string) {
    const userDataScript = `#!/bin/bash
    yum update -y
    yum install -y docker
    service docker start
    usermod -a -G docker ec2-user
    docker pull mcr.microsoft.com/playwright`;

    const params: AWS.EC2.RequestSpotFleetRequest = {
        SpotFleetRequestConfig: {
            IamFleetRole: roleArn,
            AllocationStrategy: 'lowestPrice',
            TargetCapacity: 1,
            LaunchSpecifications: [
                {
                    ImageId: amiId,
                    InstanceType: instanceType,
                    KeyName: keyPairName,
                    SecurityGroups: [
                        {
                            GroupId: securityGroupId!
                        }
                    ],
                    SubnetId: 'subnet-12345678', // Update with your subnet ID
                    Placement: {
                        AvailabilityZone: availabilityZone
                    },
                    UserData: Buffer.from(userDataScript).toString('base64')
                }
            ]
        }
    };

    const data = await ec2.requestSpotFleet(params).promise();
    return data.SpotFleetRequestId!;
}

async function deleteSecurityGroup(groupId: string) {
    const params: AWS.EC2.DeleteSecurityGroupRequest = {
        GroupId: groupId
    };
    await ec2.deleteSecurityGroup(params).promise();
}

async function deleteIamRole(roleName: string) {
    const detachParams: AWS.IAM.DetachRolePolicyRequest = {
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetRole'
    };
    await iam.detachRolePolicy(detachParams).promise();

    const deleteParams: AWS.IAM.DeleteRoleRequest = {
        RoleName: roleName
    };
    await iam.deleteRole(deleteParams).promise();
}

async function cancelSpotFleetRequest(spotFleetRequestId: string): Promise<void> {
    const params: AWS.EC2.CancelSpotFleetRequestsRequest = {
        SpotFleetRequestIds: [spotFleetRequestId],
        TerminateInstances: true
    };
    await ec2.cancelSpotFleetRequests(params).promise();
}

export {
    createIamRole,
    createSecurityGroup,
    createSpotFleet,
    deleteSecurityGroup,
    deleteIamRole,
    cancelSpotFleetRequest
};
