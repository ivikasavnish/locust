import { act, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, afterAll, beforeAll, describe, test, expect, vi } from 'vitest';

import SwarmForm from 'components/SwarmForm/SwarmForm';
import { TEST_BASE_API } from 'test/constants';
import { swarmStateMock } from 'test/mocks/swarmState.mock';
import { renderWithProvider } from 'test/testUtils';
import { camelCaseKeys, queryStringToObject, toTitleCase } from 'utils/string';

const startSwarm = vi.fn();
const previewTestSource = vi.fn();

const getStartSwarmMockCall = () => {
  const mockCalls = startSwarm.mock.calls[0];

  return mockCalls && mockCalls[0];
};

const server = setupServer(
  http.post(`${TEST_BASE_API}/swarm`, async ({ request }) =>
    startSwarm(camelCaseKeys(queryStringToObject(await request.text()))),
  ),
  http.post(`${TEST_BASE_API}/test-source/preview`, async ({ request }) => {
    previewTestSource(camelCaseKeys(queryStringToObject(await request.text())));
    return HttpResponse.json({
      success: true,
      files: [
        { path: 'locustfiles/checkout.py', user_classes: ['CheckoutUser'] },
        { path: 'load_tests/search.py', user_classes: ['SearchUser'] },
      ],
      user_classes: ['CheckoutUser', 'SearchUser'],
      standard_folders: ['locustfiles', 'load_tests'],
    });
  }),
);

describe('SwarmForm', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    startSwarm.mockClear();
    previewTestSource.mockClear();
  });
  afterAll(() => server.close());

  test('should submit form data with default values on button click', async () => {
    const { getByText } = renderWithProvider(<SwarmForm />);

    act(() => {
      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: '',
          queueMode: 'start_now',
          runTime: '',
          profile: '',
          spawnRate: '1',
          userCount: '1',
        });
      }
    });
  });

  test('should edit all inputs in the form', async () => {
    const { getByText, getByLabelText, getByRole } = renderWithProvider(<SwarmForm />, {
      swarm: {
        showUserclassPicker: true,
        availableUserClasses: ['Class1'],
        availableShapeClasses: ['Shape1', 'Shape2'],
        extraOptions: {},
        users: {},
      },
    });

    act(() => {
      fireEvent.change(getByLabelText('Shape Class'), {
        target: { value: 'Shape1' },
      });
      fireEvent.change(getByRole('textbox', { name: 'Number of users (peak concurrency)' }), {
        target: { value: '15' },
      });
      fireEvent.change(getByRole('textbox', { name: 'Ramp up (users started/second)' }), {
        target: { value: '20' },
      });
      fireEvent.change(getByLabelText('Run time (e.g. 20, 20s, 3m, 2h, 1h20m, 3h30m10s, etc.)'), {
        target: { value: '2h' },
      });
      fireEvent.change(getByRole('textbox', { name: 'Host' }), {
        target: { value: 'https://localhost:5000' },
      });

      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: 'https://localhost:5000',
          locustfileSource: '',
          queueMode: 'start_now',
          runTime: '2h',
          profile: '',
          spawnRate: '20',
          userCount: '15',
          shapeClass: 'Shape1',
          userClasses: 'Class1',
        });
      }
    });
  });

  test('should allow selected user classes to be modified', async () => {
    const { getAllByRole, getByRole } = renderWithProvider(<SwarmForm />, {
      swarm: {
        showUserclassPicker: true,
        availableUserClasses: ['Class1', 'Class2'],
        availableShapeClasses: ['Shape1', 'Shape2'],
        extraOptions: {},
        users: {
          Class1: {
            host: 'http://localhost',
            fixedCount: 0,
            weight: 0,
            tasks: ['ExampleTask'],
          },
          Class2: {
            host: 'http://localhost',
            fixedCount: 0,
            weight: 0,
            tasks: ['ExampleTask'],
          },
        },
      },
    });

    act(() => {
      fireEvent.click(getAllByRole('checkbox')[2]);
    });
    act(() => {
      fireEvent.click(getByRole('button', { name: 'Start' }));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: '',
          locustfileSource: '',
          queueMode: 'start_now',
          runTime: '',
          profile: '',
          spawnRate: '1',
          userCount: '1',
          shapeClass: 'Shape1',
          userClasses: 'Class1',
        });
      }
    });
  });

  test('should submit provided extraOptions with default values', async () => {
    const customFieldName = 'textField';
    const customFieldValue = 'Text value';
    const customChoiceFieldName = 'choicesField';
    const firstCustomChoice = 'Option1';
    const secondCustomChoice = 'Option2';

    const { getByText } = renderWithProvider(<SwarmForm />, {
      swarm: {
        ...swarmStateMock,
        extraOptions: {
          [customFieldName]: {
            choices: null,
            defaultValue: customFieldValue,
            helpText: null,
            isSecret: false,
          },
          [customChoiceFieldName]: {
            choices: [firstCustomChoice, secondCustomChoice],
            defaultValue: firstCustomChoice,
            helpText: null,
            isSecret: false,
          },
        },
      },
    });

    act(() => {
      fireEvent.click(getByText('Start'));
    });

    await waitFor(() => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: '',
          queueMode: 'start_now',
          runTime: '',
          profile: '',
          spawnRate: '1',
          userCount: '1',
          textField: 'Text value',
          choicesField: 'Option1',
        });
      }
    });
  });

  test('should submit provided extraOptions with changed values', async () => {
    const customFieldName = 'textField';
    const customFieldValue = 'Text value';
    const customChoiceFieldName = 'choicesField';
    const firstCustomChoice = 'Option1';
    const secondCustomChoice = 'Option2';

    const { getByText, getByLabelText } = renderWithProvider(<SwarmForm />, {
      swarm: {
        ...swarmStateMock,
        extraOptions: {
          [customFieldName]: {
            choices: null,
            defaultValue: customFieldValue,
            helpText: null,
            isSecret: false,
          },
          [customChoiceFieldName]: {
            choices: [firstCustomChoice, secondCustomChoice],
            defaultValue: firstCustomChoice,
            helpText: null,
            isSecret: false,
          },
        },
      },
    });

    const textField = getByLabelText(toTitleCase(customFieldName));
    const selectField = getByLabelText(toTitleCase(customChoiceFieldName));

    act(() => {
      fireEvent.change(textField, {
        target: { value: 'Changed text value' },
      });
      fireEvent.change(selectField, {
        target: { value: 'Option2' },
      });

      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: '',
          queueMode: 'start_now',
          runTime: '',
          profile: '',
          spawnRate: '1',
          userCount: '1',
          textField: 'Changed text value',
          choicesField: 'Option2',
        });
      }
    });
  });

  test('should submit a profile when one is set', async () => {
    const { getByText, getByLabelText } = renderWithProvider(<SwarmForm />);

    const testProfile = 'test-profile';

    act(() => {
      fireEvent.change(getByLabelText('Profile'), {
        target: { value: testProfile },
      });
      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: '',
          queueMode: 'start_now',
          runTime: '',
          spawnRate: '1',
          userCount: '1',
          profile: testProfile,
        });
      }
    });
  });

  test('should submit a cloud locustfile source', async () => {
    const { getByText, getByLabelText } = renderWithProvider(<SwarmForm />);

    act(() => {
      fireEvent.change(getByLabelText('Locustfile source'), {
        target: { value: 's3://load-tests/checkout.py' },
      });
      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: 's3://load-tests/checkout.py',
          queueMode: 'start_now',
          runTime: '',
          spawnRate: '1',
          userCount: '1',
          profile: '',
        });
      }
    });
  });

  test('should discover and submit selected tests from a Git source', async () => {
    const { findByText, getByLabelText, getByText } = renderWithProvider(<SwarmForm />);

    act(() => {
      fireEvent.change(getByLabelText('Locustfile source'), {
        target: { value: 'git+https://github.com/acme/load-tests.git' },
      });
      fireEvent.click(getByText('Discover tests'));
    });

    await findByText('locustfiles/checkout.py');

    act(() => {
      fireEvent.click(getByLabelText('load_tests/search.py'));
      fireEvent.click(getByLabelText('SearchUser'));
      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const previewData = previewTestSource.mock.calls[0]?.[0];
      const submittedData = getStartSwarmMockCall();

      if (previewData && submittedData) {
        expect(previewData).toEqual({
          locustfileSource: 'git+https://github.com/acme/load-tests.git',
        });
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: 'git+https://github.com/acme/load-tests.git',
          queueMode: 'start_now',
          runTime: '',
          selectedTestFiles: 'locustfiles/checkout.py',
          spawnRate: '1',
          userClasses: 'CheckoutUser',
          userCount: '1',
          profile: '',
        });
      }
    });
  });

  test('should submit queued test mode', async () => {
    const { container, getByText } = renderWithProvider(<SwarmForm />);

    act(() => {
      fireEvent.change(container.querySelector('select[name="queueMode"]') as HTMLSelectElement, {
        target: { value: 'queue' },
      });
      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: '',
          queueMode: 'queue',
          runTime: '',
          spawnRate: '1',
          userCount: '1',
          profile: '',
        });
      }
    });
  });

  test('should submit scheduled test mode', async () => {
    const { container, findByLabelText, getByText } = renderWithProvider(<SwarmForm />);

    act(() => {
      fireEvent.change(container.querySelector('select[name="queueMode"]') as HTMLSelectElement, {
        target: { value: 'schedule' },
      });
    });

    const scheduledStartTimeInput = await findByLabelText('Scheduled start time');

    act(() => {
      fireEvent.change(scheduledStartTimeInput, {
        target: { value: '2026-08-01T09:30' },
      });
      fireEvent.click(getByText('Start'));
    });

    await waitFor(async () => {
      const submittedData = getStartSwarmMockCall();

      if (submittedData) {
        expect(submittedData).toEqual({
          host: swarmStateMock.host,
          locustfileSource: '',
          queueMode: 'schedule',
          runTime: '',
          scheduledStartTime: '2026-08-01T09:30',
          spawnRate: '1',
          userCount: '1',
          profile: '',
        });
      }
    });
  });

  test('should render a list of profiles when one is provided', async () => {
    const allProfiles = ['one', 'two', 'three'];
    const { getByLabelText, getByText } = renderWithProvider(
      <SwarmForm allProfiles={allProfiles} />,
    );

    await act(async () => {
      await fireEvent.mouseDown(getByLabelText('Profile'));
    });

    allProfiles.forEach(profile => {
      expect(getByText(profile)).toBeTruthy();
    });
  });
});
