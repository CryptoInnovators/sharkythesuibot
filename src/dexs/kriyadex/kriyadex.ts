import { NAVISDKClient } from "navi-sdk/dist";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { getFullnodeUrl } from "@mysten/sui.js/client";
import { Dex } from "kriya-dex-sdk";
import { Pool as kriya_Pool } from "kriya-dex-sdk/dist/types";
import { depositCoin, SignAndSubmitTXB } from "navi-sdk/dist/libs/PTB";
import { Sui, pool } from 'navi-sdk/dist/address.js';
import { Pool, PoolConfig } from "navi-sdk/dist/types";

async function main() {
    const MNEMONIC = "";
    // console.log(MNEMONIC);

    const client = new NAVISDKClient({mnemonic: MNEMONIC, numberOfAccounts: 1});

    const naviclient = new NAVISDKClient();

    const account = client.accounts[0];
    // console.log(account.getAllCoins());

    const txb: any = new TransactionBlock();
    const url = getFullnodeUrl("testnet");
    const dex = new Dex(url);

    const pool = dex.listPools();

    
    const justswap =  await dex.swap(pool, inputCoinType, inputCoinAmoun, inputCoin, minReceived, txb, transferToAddress);
    
    console.log(dex,"dex")
    const vSui_Sui_Pool: kriya_Pool = {
        objectId: "0xf385dee283495bb70500f5f8491047cd5a2ef1b7ff5f410e6dfe8a3c3ba58716",
        tokenXType: "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT",
        tokenYType: "0x2::sui::SUI",
    };

    // step 1
    const vSui_type = "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT";
    // const vSui = await account.getCoins(vSui_type);
    const vSui = "0x62c41f7e484a62c26084325ebc75f30a9ef115e0d8a43e8014eae24e303b8a78";
    const to_swap_amount = 11 * 10 ** 9;
    // console.log(to_swap_amount);
    // const swap_sui = dex.swap(vSui_Sui_Pool, vSui_type, txb.pure(to_swap_amount), txb.object(vSui), txb.pure(10 ** 9), txb);
    const swap_sui = await txb.moveCall({
        target: "0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66::spot_dex::swap_token_x",
        arguments: [
            txb.object(vSui_Sui_Pool.objectId),
            txb.object(vSui),
            txb.pure(to_swap_amount),
            txb.pure(10 ** 9),
        ],
        typeArguments: [
            vSui_Sui_Pool.tokenXType,
            vSui_Sui_Pool.tokenYType,
        ],
    });

    // step 2
    const to_deposit_amount = 10 * 10 ** 9;
    const to_deposit_pool: PoolConfig = pool[Sui.symbol as keyof Pool];
    const to_deposit_coin = txb.splitCoins(swap_sui, [txb.pure(to_deposit_amount)]);
    await depositCoin(txb, to_deposit_pool, to_deposit_coin, to_deposit_amount);

    // transfer the remaining swap_sui
    txb.transferObjects([swap_sui], account.address);

    const result = await SignAndSubmitTXB(txb, account.client, account.keypair);
    console.log("result: ", result);
}

main();