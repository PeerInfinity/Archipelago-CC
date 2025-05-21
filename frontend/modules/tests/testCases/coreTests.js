// frontend/modules/tests/testCases/coreTests.js

export async function simpleEventTest(testController) {
  try {
    testController.log('Starting simpleEventTest...');
    testController.reportCondition('Test started', true);

    setTimeout(() => {
      console.log(
        '[Test Case - simpleEventTest] Publishing custom:testEventAfterDelay'
      );
      // Assuming testController.eventBus is the correct eventBus instance
      testController.eventBus.publish('custom:testEventAfterDelay', {
        detail: 'Event Fired!',
      });
    }, 1000);

    testController.log('Waiting for custom:testEventAfterDelay...');
    const eventData = await testController.waitForEvent(
      'custom:testEventAfterDelay',
      2000
    );

    let passCondition = eventData && eventData.detail === 'Event Fired!';
    testController.reportCondition(
      'custom:testEventAfterDelay received correctly',
      passCondition
    );
    await testController.completeTest(passCondition);
  } catch (error) {
    testController.log(`Error in simpleEventTest: ${error.message}`, 'error');
    testController.reportCondition(`Test errored: ${error.message}`, false);
    await testController.completeTest(false);
  }
}

export async function superQuickTest(testController) {
  try {
    testController.log('Starting superQuickTest...');
    testController.reportCondition('Super quick test started', true);
    // Simulate some quick synchronous operations
    let x = 1 + 1;
    if (x !== 2) {
      testController.reportCondition('Basic math failed (1+1!=2)', false);
      await testController.completeTest(false);
      return;
    }
    testController.reportCondition('Basic math passed (1+1=2)', true);
    testController.reportCondition(
      'Super quick test finished successfully',
      true
    );
    await testController.completeTest(true);
  } catch (error) {
    testController.log(`Error in superQuickTest: ${error.message}`, 'error');
    testController.reportCondition(`Test errored: ${error.message}`, false);
    await testController.completeTest(false);
  }
}
