import {SubstrateExtrinsic,SubstrateEvent,SubstrateBlock} from "@subql/types";
import {Account, AccountBalance, Asset, Block, Event, ExtrinsicV4, LockedBalance} from "../types";
import {Balance} from "@polkadot/types/interfaces";

const extrinsicMapping = {
}

const eventsMapping = {
};


export async function handleBlock(block: SubstrateBlock): Promise<void> {
    const record = new Block(block.block.header.number.toString());
    record.hash = block.block.header.hash.toString();
    record.timestamp = block.timestamp;
    await record.save();
}

export async function handleEvent(event: SubstrateEvent): Promise<void> {
    const thisEvent = await Event.get(`${event.block.block.header.number}-${event.idx.toString()}`);
    if(thisEvent === undefined){
        const record = new Event(`${event.block.block.header.number.toNumber()}-${event.idx.toString()}`);
        record.module = event.event.section;
        record.event = event.event.section;
        record.blockId = event.block.block.header.number.toString();
        record.extrinsicId = event.extrinsic.extrinsic.hash.toString();
        record.timestamp = event.block.timestamp;
        await record.save();
    }
}

export async function handleExtrinsic(extrinsic: SubstrateExtrinsic): Promise<void> {
    const thisExtrinsic = await ExtrinsicV4.get(extrinsic.extrinsic.hash.toString());
    const extrinsicHex = extrinsic.extrinsic.toHex();
    if(thisExtrinsic === undefined) {
        const record = new ExtrinsicV4(extrinsic.extrinsic.hash.toString());
        record.module = extrinsic.extrinsic.method.section;
        record.call = extrinsic.extrinsic.method.method;
        record.blockId = extrinsic.block.block.header.number.toString();
        record.success = extrinsic.success;
        record.isSigned = extrinsic.extrinsic.isSigned;
        record.nonce = extrinsic.extrinsic.nonce.toNumber();
        record.signature = extrinsic.extrinsic.signature.toString()
        record.parameters = extrinsic.extrinsic.method.args.toString();
        record.sender = extrinsic.extrinsic.signer.toString();
        record.fee = await getExtrinsicFee(extrinsicHex, extrinsic.block.block.hash.toString())
        record.tip = extrinsic.extrinsic.tip.toBigInt();
        // check immortal
        if(extrinsic.extrinsic.era.isMortalEra){
            record.lifeTime = [extrinsic.extrinsic.era.asMortalEra.birth(extrinsic.block.block.header.number.toNumber()),
                extrinsic.extrinsic.era.asMortalEra.death(extrinsic.block.block.header.number.toNumber())]
        }else {
            record.lifeTime = undefined;
        }
        record.version = extrinsic.extrinsic.version;
        record.extension = `{}`;
        record.timestamp = extrinsic.block.timestamp;
    }
}

async function getExtrinsicFee(extrinsicHex: string, blockHash: string): Promise<bigint>{
    const { partialFee } = await api.rpc.payment.queryInfo(extrinsicHex, blockHash)
    return (partialFee as Balance).toBigInt();
}

function newAsset(id:string, symbol :string,decimal: number, totalIssuance?: bigint):Asset {
    const asset = new Asset(id);
    asset.symbol = symbol;
    asset.decimal = decimal;
    asset.totalIssuance = totalIssuance;
    return asset;
}

async function newAccountBalance(accountId:string, assetId : number, freeAmount: bigint, reservedAmount: bigint, locked?:string ): Promise<AccountBalance>{
    const accountBalance = new AccountBalance(`${accountId}-${assetId}`);
    let asset = await Asset.get(assetId.toString());
    if(asset === undefined){
        const thisAsseet = await api.query.assets.metadata(assetId);
        asset = newAsset(
            assetId.toString(),
            thisAsseet.symbol.toString(),
            thisAsseet.decimals.toNumber(),
            (thisAsseet.deposit as Balance).toBigInt()
        )
        await asset.save()
    }
    accountBalance.accoutId = accountId;
    accountBalance.assetId = assetId.toString();
    accountBalance.reservedAmount = reservedAmount;
    accountBalance.freeAmount = freeAmount;
    accountBalance.locked = null;
    return accountBalance;
}

async function updateAccountBalance(accountId:string, assetId: number){
    const { nonce, data: {free,reserved,miscFrozen,feeFrozen}} = await api.query.system.account(accountId.toString());
    let accountBalance = await AccountBalance.get(`${accountId}-${assetId}`);
    if(accountBalance === undefined){
        accountBalance = await newAccountBalance(accountId, assetId, (free as Balance).toBigInt(),(reserved as Balance).toBigInt())
    }
    accountBalance.freeAmount = (free as Balance).toBigInt();
    accountBalance.reservedAmount = (reserved as Balance).toBigInt();
    const locked = await api.query.balances.locks(accountId);
    if (locked !== undefined){
        accountBalance.locked = locked.map(lock=>{
            return {
                id: lock.id.toString(),
                amount: lock.amount.toBigInt(),
                reasons: lock.reasons.toString()};
        })
    }
    await accountBalance.save();
}

export async function handleAccount(event: SubstrateEvent): Promise<void>{
    const {
        event: {
            data: [accountId],
        },
    } = event;

    let account = await Account.get(accountId.toString());
    if(account === undefined){
        account = new Account(accountId.toString());
        // account.pubKey =
    }
    const { nonce, data: AccountData } = await api.query.system.account(accountId.toString());
    const identity = await api.query.identity.identityOf(accountId)
    account.nonce = nonce.toNumber();
    account.identity = Object.assign(account.identity, identity.toJSON())
    await account.save()






}
