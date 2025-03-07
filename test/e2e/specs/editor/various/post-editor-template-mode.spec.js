/**
 * WordPress dependencies
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.use( {
	postEditorTemplateMode: async (
		{ page, pageUtils, requestUtils },
		use
	) => {
		await use(
			new PostEditorTemplateMode( { page, pageUtils, requestUtils } )
		);
	},
} );

test.describe( 'Post Editor Template mode', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.activatePlugin( 'gutenberg-test-block-templates' );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllTemplates( 'wp_template' ),
			requestUtils.deleteAllTemplates( 'wp_template_part' ),
		] );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.activateTheme( 'twentytwentyone' );
		await requestUtils.deactivatePlugin( 'gutenberg-test-block-templates' );
	} );

	test( 'Allow to switch to template mode, edit the template and check the result', async ( {
		page,
		pageUtils,
		requestUtils,
		postEditorTemplateMode,
	} ) => {
		await requestUtils.activateTheme( 'emptytheme' );

		await postEditorTemplateMode.createPostAndSaveDraft();

		await page.reload();
		await postEditorTemplateMode.switchToTemplateMode();

		// Edit the template.
		await pageUtils.insertBlock( { name: 'core/paragraph' } );
		await page.keyboard.type(
			'Just a random paragraph added to the template'
		);

		// Save changes.
		await page.click( 'role=button[name="Publish"i]' );
		await page.click( 'role=button[name="Save"i]' );

		// Preview changes.
		const previewPage = await pageUtils.openPreviewPage();

		await expect(
			previewPage.locator(
				'text="Just a random paragraph added to the template"'
			)
		).toBeVisible();
	} );

	test( 'Allow creating custom block templates in classic themes', async ( {
		page,
		pageUtils,
		requestUtils,
		postEditorTemplateMode,
	} ) => {
		await requestUtils.activateTheme( 'twentytwentyone' );

		await postEditorTemplateMode.createPostAndSaveDraft();

		await page.reload();

		await postEditorTemplateMode.createNewTemplate( 'Blank Template' );

		// Edit the template.
		await pageUtils.insertBlock( { name: 'core/paragraph' } );
		await page.keyboard.type(
			'Just a random paragraph added to the template'
		);

		await postEditorTemplateMode.saveTemplateWithoutPublishing();

		// Preview changes.
		const previewPage = await pageUtils.openPreviewPage();
		const siteBlocks = await previewPage.waitForSelector(
			'.wp-site-blocks'
		);
		const content = await siteBlocks.innerHTML();

		expect( content ).toMatchSnapshot();
	} );

	test.describe( 'Delete Post Template Confirmation Dialog', () => {
		test.beforeAll( async ( { requestUtils } ) => {
			await requestUtils.activateTheme( 'twentytwentyone' );
		} );

		test.beforeEach( async ( { postEditorTemplateMode } ) => {
			await postEditorTemplateMode.createPostAndSaveDraft();
		} );

		[ 'large', 'small' ].forEach( ( viewport ) => {
			test( `should retain template if deletion is canceled when the viewport is ${ viewport }`, async ( {
				page,
				pageUtils,
				postEditorTemplateMode,
			} ) => {
				await pageUtils.setBrowserViewport( viewport );

				await postEditorTemplateMode.disableTemplateWelcomeGuide();

				const templateTitle = `${ viewport } Viewport Deletion Test`;

				await postEditorTemplateMode.createNewTemplate( templateTitle );

				// Close the settings in small viewport.
				if ( viewport === 'small' ) {
					await page.click( 'role=button[name="Close settings"i]' );
				}

				// Edit the template.
				await pageUtils.insertBlock( { name: 'core/paragraph' } );
				await page.keyboard.type(
					'Just a random paragraph added to the template'
				);

				await postEditorTemplateMode.saveTemplateWithoutPublishing();

				// Test deletion dialog.
				{
					const templateDropdown = postEditorTemplateMode.editorTopBar.locator(
						'role=button[name="Template Options"i]'
					);
					await templateDropdown.click();
					await page.click(
						'role=menuitem[name="Delete template"i]'
					);

					const confirmDeletionDialog = page.locator( 'role=dialog' );
					await expect( confirmDeletionDialog ).toBeFocused();
					await expect(
						confirmDeletionDialog.locator(
							`text=Are you sure you want to delete the ${ templateTitle } template? It may be used by other pages or posts.`
						)
					).toBeVisible();

					await confirmDeletionDialog
						.locator( 'role=button[name="Cancel"i]' )
						.click();
				}

				// Exit template mode.
				await page.click( 'role=button[name="Back"i]' );

				await pageUtils.openDocumentSettingsSidebar();

				// Move focus to the "Post" panel in the editor sidebar.
				const postPanel = postEditorTemplateMode.editorSettingsSidebar.locator(
					'role=button[name="Post"i]'
				);
				await postPanel.click();

				const templateSelect = postEditorTemplateMode.editorSettingsSidebar.locator(
					'role=combobox[name="Template:"i]'
				);
				await expect( templateSelect ).toHaveValue(
					`wp-custom-template-${ viewport }-viewport-deletion-test`
				);
			} );

			test( `should delete template if deletion is confirmed when the viewport is ${ viewport }`, async ( {
				page,
				pageUtils,
				postEditorTemplateMode,
			} ) => {
				const templateTitle = `${ viewport } Viewport Deletion Test`;

				await pageUtils.setBrowserViewport( viewport );

				await postEditorTemplateMode.createNewTemplate( templateTitle );

				// Close the settings in small viewport.
				if ( viewport === 'small' ) {
					await page.click( 'role=button[name="Close settings"i]' );
				}

				// Edit the template.
				await pageUtils.insertBlock( { name: 'core/paragraph' } );
				await page.keyboard.type(
					'Just a random paragraph added to the template'
				);

				await postEditorTemplateMode.saveTemplateWithoutPublishing();

				{
					const templateDropdown = postEditorTemplateMode.editorTopBar.locator(
						'role=button[name="Template Options"i]'
					);
					await templateDropdown.click();
					await page.click(
						'role=menuitem[name="Delete template"i]'
					);

					const confirmDeletionDialog = page.locator( 'role=dialog' );
					await expect( confirmDeletionDialog ).toBeFocused();
					await expect(
						confirmDeletionDialog.locator(
							`text=Are you sure you want to delete the ${ templateTitle } template? It may be used by other pages or posts.`
						)
					).toBeVisible();

					await confirmDeletionDialog
						.locator( 'role=button[name="OK"i]' )
						.click();
				}

				// Saving isn't technically necessary, but for themes without any specified templates,
				// the removal of the Templates dropdown is delayed. A save and reload allows for this
				// delay and prevents flakiness
				{
					await page.click( 'role=button[name="Save draft"i]' );
					await page.waitForSelector(
						'role=button[name="Dismiss this notice"] >> text=Draft saved'
					);
					await page.reload();
				}

				const templateOptions = postEditorTemplateMode.editorSettingsSidebar.locator(
					'role=combobox[name="Template:"i] >> role=menuitem'
				);
				const availableTemplates = await templateOptions.allTextContents();

				expect( availableTemplates ).not.toContain(
					`${ viewport } Viewport Deletion Test`
				);
			} );
		} );
	} );
} );

class PostEditorTemplateMode {
	constructor( { page, pageUtils, requestUtils } ) {
		this.page = page;
		this.pageUtils = pageUtils;
		this.requestUtils = requestUtils;

		this.editorSettingsSidebar = this.page.locator(
			'role=region[name="Editor settings"i]'
		);
		this.editorTopBar = this.page.locator(
			'role=region[name="Editor top bar"i]'
		);
	}

	async disableTemplateWelcomeGuide() {
		// Turn off the welcome guide.
		await this.page.evaluate( () => {
			window.wp.data
				.dispatch( 'core/preferences' )
				.set( 'core/edit-post', 'welcomeGuideTemplate', false );
		} );
	}

	async expandTemplatePanel() {
		await this.pageUtils.openDocumentSettingsSidebar();

		const templatePanelButton = this.editorSettingsSidebar.locator(
			'role=button[name="Template"i]'
		);
		const isExpanded =
			( await templatePanelButton.getAttribute( 'aria-expanded' ) ) !==
			'false';
		if ( ! isExpanded ) {
			await templatePanelButton.click();
		}
	}

	async switchToTemplateMode() {
		await this.disableTemplateWelcomeGuide();

		await this.expandTemplatePanel();

		await this.editorSettingsSidebar
			.locator( 'role=button[name="Edit"i]' )
			.click();

		// Check that we switched properly to edit mode.
		await this.page.waitForSelector(
			'role=button[name="Dismiss this notice"] >> text=Editing template. Changes made here affect all posts and pages that use the template.'
		);

		await expect( this.editorTopBar ).toHaveText( /Just an FSE Post/ );
	}

	async createPostAndSaveDraft() {
		await this.pageUtils.createNewPost();
		// Create a random post.
		await this.page.keyboard.type( 'Just an FSE Post' );
		await this.page.keyboard.press( 'Enter' );
		await this.page.keyboard.type( 'Hello World' );

		// Unselect the blocks.
		await this.page.evaluate( () => {
			window.wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock();
		} );

		// Save the post
		// Saving shouldn't be necessary but unfortunately,
		// there's a template resolution bug forcing us to do so.
		await this.page.click( 'role=button[name="Save draft"i]' );
		await this.page.waitForSelector(
			'role=button[name="Dismiss this notice"] >> text=Draft saved'
		);
	}

	async createNewTemplate( templateName ) {
		await this.disableTemplateWelcomeGuide();

		await this.expandTemplatePanel();

		const newTemplateButton = this.editorSettingsSidebar.locator(
			'role=button[name="New"i]'
		);
		await newTemplateButton.click();

		// Fill the template title and submit.
		const newTemplateDialog = this.page.locator(
			'role=dialog[name="Create custom template"i]'
		);
		const templateNameInput = newTemplateDialog.locator(
			'role=textbox[name="Name"i]'
		);
		await templateNameInput.fill( templateName );
		await this.page.keyboard.press( 'Enter' );

		// Check that we switched properly to edit mode.
		await expect(
			this.page.locator(
				'role=button[name="Dismiss this notice"i] >> text=Custom template created. You\'re in template mode now.'
			)
		).toBeVisible();

		// Wait for the editor to be loaded and ready before making changes.
		// Without this, the editor will move focus to body while still typing.
		// And the save states will not be counted as dirty.
		// There is likely a bug in the code, waiting for the snackbar above should be enough.
		await this.page.waitForLoadState( 'networkidle' );
	}

	async saveTemplateWithoutPublishing() {
		await this.page.click( 'role=button[name="Publish"i]' );
		const editorPublishRegion = this.page.locator(
			'role=region[name="Editor publish"i]'
		);
		const saveButton = editorPublishRegion.locator(
			'role=button[name="Save"i]'
		);
		await saveButton.click();
		// Avoid publishing the post.
		const cancelButton = editorPublishRegion.locator(
			'role=button[name="Cancel"i]'
		);
		await cancelButton.click();
	}
}
