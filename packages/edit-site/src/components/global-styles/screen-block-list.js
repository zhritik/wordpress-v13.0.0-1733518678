/**
 * WordPress dependencies
 */
import { store as blocksStore } from '@wordpress/blocks';
import { __, sprintf, _n } from '@wordpress/i18n';
import {
	FlexItem,
	SearchControl,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useState, useMemo, useEffect, useRef } from '@wordpress/element';
import { BlockIcon } from '@wordpress/block-editor';
import { useDebounce } from '@wordpress/compose';
import { speak } from '@wordpress/a11y';

/**
 * Internal dependencies
 */
import { useHasBorderPanel } from './border-panel';
import { useHasColorPanel } from './color-utils';
import { useHasDimensionsPanel } from './dimensions-panel';
import { useHasTypographyPanel } from './typography-panel';
import ScreenHeader from './header';
import { NavigationButton } from './navigation-button';

function useSortedBlockTypes() {
	const blockItems = useSelect(
		( select ) => select( blocksStore ).getBlockTypes(),
		[]
	);
	// Ensure core blocks are prioritized in the returned results,
	// because third party blocks can be registered earlier than
	// the core blocks (usually by using the `init` action),
	// thus affecting the display order.
	// We don't sort reusable blocks as they are handled differently.
	const groupByType = ( blocks, block ) => {
		const { core, noncore } = blocks;
		const type = block.name.startsWith( 'core/' ) ? core : noncore;
		type.push( block );
		return blocks;
	};
	const {
		core: coreItems,
		noncore: nonCoreItems,
	} = blockItems.reduce( groupByType, { core: [], noncore: [] } );
	return [ ...coreItems, ...nonCoreItems ];
}

function BlockMenuItem( { block } ) {
	const hasTypographyPanel = useHasTypographyPanel( block.name );
	const hasColorPanel = useHasColorPanel( block.name );
	const hasBorderPanel = useHasBorderPanel( block.name );
	const hasDimensionsPanel = useHasDimensionsPanel( block.name );
	const hasLayoutPanel = hasBorderPanel || hasDimensionsPanel;
	const hasBlockMenuItem =
		hasTypographyPanel || hasColorPanel || hasLayoutPanel;

	if ( ! hasBlockMenuItem ) {
		return null;
	}

	return (
		<NavigationButton path={ '/blocks/' + block.name }>
			<HStack justify="flex-start">
				<BlockIcon icon={ block.icon } />
				<FlexItem>{ block.title }</FlexItem>
			</HStack>
		</NavigationButton>
	);
}

function ScreenBlockList() {
	const sortedBlockTypes = useSortedBlockTypes();
	const [ filterValue, setFilterValue ] = useState( '' );
	const debouncedSpeak = useDebounce( speak, 500 );
	const isMatchingSearchTerm = useSelect(
		( select ) => select( blocksStore ).isMatchingSearchTerm,
		[]
	);
	const filteredBlockTypes = useMemo( () => {
		if ( ! filterValue ) {
			return sortedBlockTypes;
		}
		return sortedBlockTypes.filter( ( blockType ) =>
			isMatchingSearchTerm( blockType, filterValue )
		);
	}, [ filterValue, sortedBlockTypes, isMatchingSearchTerm ] );

	const blockTypesListRef = useRef();

	// Announce search results on change
	useEffect( () => {
		if ( ! filterValue ) {
			return;
		}
		// We extract the results from the wrapper div's `ref` because
		// filtered items can contain items that will eventually not
		// render and there is no reliable way to detect when a child
		// will return `null`.
		// TODO: We should find a better way of handling this as it's
		// fragile and depends on the number of rendered elements of `BlockMenuItem`,
		// which is now one.
		// @see https://github.com/WordPress/gutenberg/pull/39117#discussion_r816022116
		const count = blockTypesListRef.current.childElementCount;
		const resultsFoundMessage = sprintf(
			/* translators: %d: number of results. */
			_n( '%d result found.', '%d results found.', count ),
			count
		);
		debouncedSpeak( resultsFoundMessage, count );
	}, [ filterValue, debouncedSpeak ] );

	return (
		<>
			<ScreenHeader
				title={ __( 'Blocks' ) }
				description={ __(
					'Customize the appearance of specific blocks and for the whole site.'
				) }
			/>
			<SearchControl
				className="edit-site-block-types-search"
				onChange={ setFilterValue }
				value={ filterValue }
				label={ __( 'Search for blocks' ) }
				placeholder={ __( 'Search' ) }
			/>
			<div
				ref={ blockTypesListRef }
				className="edit-site-block-types-item-list"
			>
				{ filteredBlockTypes.map( ( block ) => (
					<BlockMenuItem
						block={ block }
						key={ 'menu-itemblock-' + block.name }
					/>
				) ) }
			</div>
		</>
	);
}

export default ScreenBlockList;
