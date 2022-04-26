import * as React from "react";
import type { LoaderFunction, MetaFunction } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import type { ShouldReloadFunction } from "@remix-run/react";
import { useCatch, useLoaderData } from "@remix-run/react";
import { useNumberField } from "@react-aria/numberfield";
import { useLocale } from "@react-aria/i18n";
import { useNumberFieldState } from "@react-stately/numberfield";
import { PlusIcon } from "@heroicons/react/solid";
import { Link, useParams, useSearchParams } from "@remix-run/react";
import cn from "clsx";
import invariant from "tiny-invariant";
import { Button } from "~/components/Button";
import { Switch } from "@headlessui/react";
import { formatUsd, getLpTokenCount, getTokenCount } from "~/utils/price";
import { formatNumber, getFormatOptions } from "~/utils/number";
import { getPairById } from "~/utils/pair.server";
import { Pair, PairToken } from "~/types";
import { useAddressBalance, useTokenBalance } from "~/hooks/useTokenBalance";
import { useAddLiquidity } from "~/hooks/useAddLiquidity";

type LoaderData = {
  pair: Pair;
};

const tabs = [
  { name: "Liquidity", query: "liquidity" },
  { name: "Stake", query: "stake" },
  { name: "Rewards", query: "rewards" },
] as const;

export const meta: MetaFunction = ({ data }: { data: LoaderData }) => ({
  title: `${data.pair.name} - Manage - Magicswap`,
});

export const loader: LoaderFunction = async ({ params: { poolId } }) => {
  invariant(poolId, `poolId is required`);

  const pair = await getPairById(poolId);

  if (!pair) {
    throw new Response("Pool not found", {
      status: 404,
    });
  }

  return json<LoaderData>({ pair });
};

export const unstable_shouldReload: ShouldReloadFunction = () => false;

const TokenInput = ({
  className,
  token,
  tokenSymbol,
  price,
  balance = 0,
  ...numberFieldProps
}: Parameters<typeof useNumberField>[0] & {
  className?: string;
  token?: PairToken;
  tokenSymbol?: string;
  price?: number;
  balance?: number;
}) => {
  const { locale } = useLocale();
  const state = useNumberFieldState({ ...numberFieldProps, locale });
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const { labelProps, inputProps } = useNumberField(
    numberFieldProps,
    state,
    inputRef
  );

  return (
    <div className={className}>
      <label className="sr-only" {...labelProps}>
        {numberFieldProps.label}
      </label>
      <div className="relative focus-within:border-red-600">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center space-x-2 pl-3 pb-4">
          <img
            src="https://via.placeholder.com/400"
            alt="placeholder"
            className="z-10 h-4 w-4 rounded-full ring-1"
          />
          <span className="block font-semibold text-white sm:text-sm">
            {token?.symbol ?? tokenSymbol}
          </span>
        </div>
        <input
          {...inputProps}
          ref={inputRef}
          className="block w-full rounded-md border-0 bg-gray-900 pl-7 pb-6 text-right focus:outline-none focus:ring-2 focus:ring-red-600 sm:text-lg lg:text-2xl"
          placeholder="0.00"
        />
        <div className="pointer-events-none absolute left-0 bottom-2 flex flex-col items-end pl-3">
          <span className="text-xs text-gray-500">
            Balance: {formatNumber(balance)}
          </span>
        </div>
        <div className="pointer-events-none absolute bottom-2 right-0 flex flex-col items-end pr-3">
          <span className="text-xs text-gray-500">
            ~{" "}
            {formatUsd(
              (token?.priceUsd ?? price ?? 0) *
                (Number.isNaN(state.numberValue) ? 1 : state.numberValue)
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function Manage() {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const selectedTab =
    tabs.find(({ query }) => query === searchParams.get("tab")) ?? tabs[0];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = tab.name === selectedTab.name;
            return (
              <Link
                key={tab.name}
                to={`/pools/${params.poolId}/manage?tab=${tab.query}`}
                className={cn(
                  isActive
                    ? "border-red-500 bg-gray-500/20 text-white"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                  "flex-1 whitespace-nowrap border-t-2 py-3 px-4 text-center text-xs font-medium sm:flex-none sm:py-4 sm:px-8 sm:text-left sm:text-sm"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
      {(() => {
        switch (selectedTab.query) {
          case "liquidity":
            return <Liquidity />;
          case "stake":
            return <Stake />;
          case "rewards":
            return <div>Rewards</div>;
        }
      })()}
    </div>
  );
}

const Liquidity = () => {
  const [isAddLiquidity, setIsAddLiquidity] = React.useState(false);
  const [removeInputValue, setRemoveInputValue] = React.useState(0);
  const [addInputValues, setAddInputValues] = React.useState<[number, number]>([
    0, 0,
  ]);
  const { pair } = useLoaderData<LoaderData>();

  const token0Balance = useTokenBalance(pair.token0);
  const token1Balance = useTokenBalance(pair.token1);
  const lpBalance = useAddressBalance(pair.id);
  const addLiquidity = useAddLiquidity();

  const handleAdd0InputChanged = (value: number) => {
    setAddInputValues([value, value * pair.token1.price]);
  };

  const handleAdd1InputChanged = (value: number) => {
    setAddInputValues([value * pair.token0.price, value]);
  };

  const handleAddLiquidity = () => {
    addLiquidity(pair, addInputValues[0], addInputValues[1], 0.5);
  };

  const handleRemoveLiquidity = () => {};

  const token0BalanceInsufficient = addInputValues[0] > token0Balance;
  const token1BalanceInsufficient = addInputValues[1] > token1Balance;

  return (
    <div className="flex flex-1 items-center justify-center p-6 lg:p-8">
      <div className="flex max-w-xl flex-1 flex-col space-y-4">
        <div className="flex items-center space-x-2">
          <span
            className={cn(
              isAddLiquidity && "text-gray-500",
              "text-[0.6rem] font-bold uppercase sm:text-base"
            )}
          >
            Remove Liquidity
          </span>
          <Switch
            checked={isAddLiquidity}
            onChange={setIsAddLiquidity}
            className="group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full ring-offset-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <span className="sr-only">
              {isAddLiquidity ? "Remove Liquidity" : "Add Liquidity"}
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-full w-full rounded-md bg-gray-800"
            />
            <span
              aria-hidden="true"
              className={cn(
                isAddLiquidity ? "bg-[#E5003E]" : "bg-gray-200",
                "pointer-events-none absolute mx-auto h-2.5 w-8 rounded-full transition-colors duration-200 ease-in-out"
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                isAddLiquidity ? "translate-x-5" : "translate-x-0",
                "pointer-events-none absolute left-0 inline-block h-4 w-4 transform rounded-full border border-[#FF4E7E] bg-[#FF4E7E] shadow ring-0 transition-transform duration-200 ease-in-out"
              )}
            />
          </Switch>
          <span
            className={cn(
              !isAddLiquidity && "text-gray-500",
              "text-[0.6rem] font-bold uppercase sm:text-base"
            )}
          >
            Add Liquidity
          </span>
        </div>
        {isAddLiquidity ? (
          <div className="space-y-4">
            <TokenInput
              id="addLiquidityToken0"
              label="Amount"
              token={pair.token0}
              balance={token0Balance}
              value={addInputValues[0]}
              onChange={handleAdd0InputChanged}
              formatOptions={getFormatOptions(addInputValues[0])}
            />
            <div className="flex justify-center">
              <PlusIcon className="h-4 w-4 text-gray-400" />
            </div>
            <TokenInput
              id="addLiquidityToken1"
              label="Amount"
              token={pair.token1}
              balance={token1Balance}
              value={addInputValues[1]}
              onChange={handleAdd1InputChanged}
              formatOptions={getFormatOptions(addInputValues[1])}
            />
            {addInputValues.some((value) => value > 0) && (
              <div className="space-y-2 rounded-md bg-gray-900 p-4">
                <p className="text-xs text-gray-600 sm:text-base">
                  You'll receive (at least):
                </p>
                <p className="text-sm font-medium sm:text-lg">
                  ≈{" "}
                  {formatNumber(
                    getLpTokenCount(
                      addInputValues[0],
                      pair.token0.reserve,
                      pair.totalSupply
                    )
                  )}{" "}
                  {pair.name} Pool Tokens
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <TokenInput
              id="removeLiquidity"
              label="Amount"
              tokenSymbol={`${pair.name} LP`}
              price={pair.lpPriceUsd}
              balance={lpBalance}
              onChange={(value) => setRemoveInputValue(value)}
            />
            {removeInputValue > 0 && (
              <div className="space-y-2 rounded-md bg-gray-900 p-4">
                <p className="text-xs text-gray-600 sm:text-base">
                  You'll receive (at least):
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {formatNumber(
                      getTokenCount(
                        removeInputValue,
                        pair.token0.reserve,
                        pair.totalSupply
                      )
                    )}{" "}
                    {pair.token0.symbol}
                  </span>
                  <span className="text-gray-200">
                    ≈{" "}
                    {formatUsd(
                      getTokenCount(
                        removeInputValue,
                        pair.token0.reserve,
                        pair.totalSupply
                      ) * pair.token0.priceUsd
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {formatNumber(
                      getTokenCount(
                        removeInputValue,
                        pair.token1.reserve,
                        pair.totalSupply
                      )
                    )}{" "}
                    {pair.token1.symbol}
                  </span>
                  <span className="text-gray-200">
                    ={" "}
                    {formatUsd(
                      getTokenCount(
                        removeInputValue,
                        pair.token1.reserve,
                        pair.totalSupply
                      ) * pair.token1.priceUsd
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
        <Button
          disabled={token0BalanceInsufficient || token1BalanceInsufficient}
          onClick={isAddLiquidity ? handleAddLiquidity : handleRemoveLiquidity}
        >
          {token0BalanceInsufficient || token1BalanceInsufficient ? (
            <>
              Insufficient{" "}
              {token0BalanceInsufficient
                ? pair.token0.symbol
                : pair.token1.symbol}{" "}
              Balance
            </>
          ) : (
            <>{isAddLiquidity ? "Add" : "Remove"} Liquidity</>
          )}
        </Button>
      </div>
    </div>
  );
};

const Stake = () => {
  const [isStake, setIsStake] = React.useState(true);

  return (
    <div className="flex flex-1 items-center justify-center p-6 lg:p-8">
      <div className="flex max-w-xl flex-1 flex-col space-y-4">
        <div className="flex items-center space-x-2">
          <span
            className={cn(
              isStake && "text-gray-500",
              "text-[0.6rem] font-bold uppercase sm:text-base"
            )}
          >
            Unstake
          </span>
          <Switch
            checked={isStake}
            onChange={setIsStake}
            className="group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full ring-offset-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <span className="sr-only">
              {isStake ? "Remove Liquidity" : "Add Liquidity"}
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-full w-full rounded-md bg-gray-800"
            />
            <span
              aria-hidden="true"
              className={cn(
                isStake ? "bg-[#E5003E]" : "bg-gray-200",
                "pointer-events-none absolute mx-auto h-2.5 w-8 rounded-full transition-colors duration-200 ease-in-out"
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                isStake ? "translate-x-5" : "translate-x-0",
                "pointer-events-none absolute left-0 inline-block h-4 w-4 transform rounded-full border border-[#FF4E7E] bg-[#FF4E7E] shadow ring-0 transition-transform duration-200 ease-in-out"
              )}
            />
          </Switch>
          <span
            className={cn(
              !isStake && "text-gray-500",
              "text-[0.6rem] font-bold uppercase sm:text-base"
            )}
          >
            Stake
          </span>
        </div>
        <div className="flex justify-around space-x-3 sm:block">
          <button className="rounded-md bg-gray-900 py-2.5 px-3.5 text-[0.6rem] font-medium text-white ring-offset-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:text-xs">
            25%
          </button>
          <button className="rounded-md bg-gray-900 py-2.5 px-3.5 text-[0.6rem] font-medium text-white ring-offset-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:text-xs">
            50%
          </button>
          <button className="rounded-md bg-gray-900 py-2.5 px-3.5 text-[0.6rem] font-medium text-white ring-offset-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:text-xs">
            75%
          </button>
          <button className="rounded-md bg-gray-900 py-2.5 px-3.5 text-[0.6rem] font-medium text-white ring-offset-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 sm:text-xs">
            100%
          </button>
        </div>
        <TokenInput tokenSymbol="SLP" />
        <Button>{isStake ? "Stake" : "Unstake"}</Button>
      </div>
    </div>
  );
};

export function CatchBoundary() {
  const caught = useCatch();
  const params = useParams();
  if (caught.status === 404) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-[0.6rem] text-gray-500 sm:text-base">
          {params.poolId} not found.
        </p>
      </div>
    );
  }
  throw new Error(`Unhandled error: ${caught.status}`);
}
